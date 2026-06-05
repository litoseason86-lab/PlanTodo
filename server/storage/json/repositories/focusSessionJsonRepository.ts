import type {
  CreateRunningSessionInput,
  FocusSessionRepository,
  PauseSessionInput,
  ResumeSessionInput,
  StopSessionInput,
} from '../../../modules/focus/repository';
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {JsonFileStore} from '../fileStore';

function completeSession(
  session: TaskExecutionSession,
  endedAt: string,
): TaskExecutionSession {
  const accumulatedPauseSeconds = session.accumulatedPauseSeconds ?? 0;
  const activePauseSeconds =
    session.status === 'PAUSED' && session.pausedAt
      ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(session.pausedAt).getTime()) / 1000))
      : 0;
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      - accumulatedPauseSeconds
      - activePauseSeconds,
  );

  session.endedAt = endedAt;
  session.durationSeconds = durationSeconds;
  session.accumulatedPauseSeconds = accumulatedPauseSeconds + activePauseSeconds;
  session.pausedAt = undefined;
  session.status = 'COMPLETED';

  return session;
}

function findSession(
  sessions: TaskExecutionSession[],
  sessionId: number,
  userId: number,
): TaskExecutionSession | undefined {
  return sessions.find((item) => item.id === sessionId && item.userId === userId);
}

export class FocusSessionJsonRepository implements FocusSessionRepository {
  constructor(private readonly store: JsonFileStore) {}

  getRunningByUser(userId: number): TaskExecutionSession | undefined {
    return this.store.read().taskExecutionSessions.find((session) => {
      return session.userId === userId && (session.status === 'RUNNING' || session.status === 'PAUSED');
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
        accumulatedPauseSeconds: 0,
        createdAt: startedAt,
      };
      data.taskExecutionSessions.push(session);
      return session;
    });
  }

  pause(input: PauseSessionInput): TaskExecutionSession | undefined {
    return this.store.update((data) => {
      const session = findSession(data.taskExecutionSessions, input.sessionId, input.userId);
      if (!session || session.status !== 'RUNNING') {
        return undefined;
      }

      session.status = 'PAUSED';
      session.pausedAt = input.pausedAt ?? new Date().toISOString();
      session.accumulatedPauseSeconds = session.accumulatedPauseSeconds ?? 0;
      return session;
    });
  }

  resume(input: ResumeSessionInput): TaskExecutionSession | undefined {
    return this.store.update((data) => {
      const session = findSession(data.taskExecutionSessions, input.sessionId, input.userId);
      if (!session || session.status !== 'PAUSED' || !session.pausedAt) {
        return undefined;
      }

      const resumedAt = input.resumedAt ?? new Date().toISOString();
      const pauseSeconds = Math.max(
        0,
        Math.round((new Date(resumedAt).getTime() - new Date(session.pausedAt).getTime()) / 1000),
      );
      session.accumulatedPauseSeconds = (session.accumulatedPauseSeconds ?? 0) + pauseSeconds;
      session.pausedAt = undefined;
      session.status = 'RUNNING';
      return session;
    });
  }

  stop(input: StopSessionInput): TaskExecutionSession | undefined {
    return this.store.update((data) => {
      const session = findSession(data.taskExecutionSessions, input.sessionId, input.userId);
      if (!session || (session.status !== 'RUNNING' && session.status !== 'PAUSED')) {
        return undefined;
      }

      return completeSession(session, input.endedAt ?? new Date().toISOString());
    });
  }
}
