import type {TaskExecutionSession} from '../../../shared/domain/entities';

export interface CreateRunningSessionInput {
  taskId: number;
  userId: number;
  startedAt?: string;
}

export interface StopSessionInput {
  sessionId: number;
  userId: number;
  endedAt?: string;
}

export interface FocusSessionRepository {
  getRunningByUser(userId: number): TaskExecutionSession | undefined;
  listByTask(taskId: number, userId: number): TaskExecutionSession[];
  listByDateRange(userId: number, startAt: string, endAt: string): TaskExecutionSession[];
  createRunning(input: CreateRunningSessionInput): TaskExecutionSession;
  stop(input: StopSessionInput): TaskExecutionSession | undefined;
}

