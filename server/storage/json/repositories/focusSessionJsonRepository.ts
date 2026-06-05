import type {
  CreateRunningSessionInput,
  FocusSessionRepository,
  StopSessionInput,
} from '../../../modules/focus/repository';
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {JsonFileStore} from '../fileStore';

function completeSession(
  session: TaskExecutionSession,
  endedAt: string,
): TaskExecutionSession {
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000),
  );

  session.endedAt = endedAt;
  session.durationSeconds = durationSeconds;
  session.status = 'COMPLETED';

  return session;
}

export class FocusSessionJsonRepository implements FocusSessionRepository {
  constructor(private readonly store: JsonFileStore) {}

  getRunningByUser(userId: number): TaskExecutionSession | undefined {
    return this.store.read().taskExecutionSessions.find((session) => {
      return session.userId === userId && session.status === 'RUNNING';
    });
  }

  listByTask(taskId: number, userId: number): TaskExecutionSession[] {
    return this.store
      .read()
      .taskExecutionSessions.filter((session) => session.taskId === taskId && session.userId === userId)
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime());
  }

  listByDateRange(userId: number, startAt: string, endAt: string): TaskExecutionSession[] {
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();

    return this.store.read().taskExecutionSessions.filter((session) => {
      if (session.userId !== userId) return false;
      const startedAtMs = new Date(session.startedAt).getTime();
      return startedAtMs >= startMs && startedAtMs <= endMs;
    });
  }

  createRunning(input: CreateRunningSessionInput): TaskExecutionSession {
    return this.store.update((data) => {
      data.sequences.taskExecutionSessions += 1;
      const startedAt = input.startedAt ?? new Date().toISOString();
      const session: TaskExecutionSession = {
        id: data.sequences.taskExecutionSessions,
        taskId: input.taskId,
        userId: input.userId,
        startedAt,
        status: 'RUNNING',
        createdAt: startedAt,
      };
      data.taskExecutionSessions.push(session);
      return session;
    });
  }

  stop(input: StopSessionInput): TaskExecutionSession | undefined {
    return this.store.update((data) => {
      const session = data.taskExecutionSessions.find((item) => {
        return item.id === input.sessionId && item.userId === input.userId;
      });
      if (!session || session.status !== 'RUNNING') {
        return undefined;
      }

      return completeSession(session, input.endedAt ?? new Date().toISOString());
    });
  }
}

