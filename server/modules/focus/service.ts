import {AppError} from '../../shared/errors/appError';
import type {TaskRepository} from '../tasks/repository';
import type {FocusSessionRepository} from './repository';
import {getChinaDateUtcRange} from '../../../shared/lib/date';

export class FocusService {
  constructor(
    private readonly tasks: Pick<TaskRepository, 'getById' | 'updateStatus'>,
    private readonly sessions: FocusSessionRepository,
  ) {}

  listByDate(userId: number, date?: string) {
    if (!date) {
      return [];
    }

    const {startAt, endAt} = getChinaDateUtcRange(date);

    return this.sessions.listByDateRange(userId, startAt, endAt);
  }

  getRunning(userId: number) {
    return this.sessions.getRunningByUser(userId) ?? null;
  }

  listByTask(taskId: number, userId: number) {
    return this.sessions.listByTask(taskId, userId);
  }

  start(input: {taskId: number; userId: number}) {
    const running = this.sessions.getRunningByUser(input.userId);
    if (running) {
      throw new AppError(409, 'A focus session is already running. Please complete it first.');
    }

    const task = this.tasks.getById(input.taskId, input.userId);
    if (!task) {
      throw new AppError(404, 'Task not found.');
    }

    const session = this.sessions.createRunning(input);
    this.tasks.updateStatus(input.taskId, input.userId, 'IN_PROGRESS');

    return session;
  }

  stop(input: {sessionId: number; userId: number}) {
    const session = this.sessions.stop(input);
    if (!session) {
      throw new AppError(400, 'Session is not running.');
    }

    const task = this.tasks.getById(session.taskId, input.userId);
    if (task?.status === 'IN_PROGRESS') {
      this.tasks.updateStatus(session.taskId, input.userId, 'TODO');
    }

    return session;
  }

  pause(input: {sessionId: number; userId: number}) {
    const session = this.sessions.pause(input);
    if (!session) {
      throw new AppError(400, 'Session is not running.');
    }

    return session;
  }

  resume(input: {sessionId: number; userId: number}) {
    const session = this.sessions.resume(input);
    if (!session) {
      throw new AppError(400, 'Session is not paused.');
    }

    return session;
  }
}
