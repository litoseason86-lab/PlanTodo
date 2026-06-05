import type {FocusSessionRepository} from '../focus/repository';
import {AppError} from '../../shared/errors/appError';
import type {CategoryRepository} from '../categories/repository';
import type {CreateTaskInput, TaskRepository} from './repository';
import {TASK_STATUSES, type TaskStatus} from '../../../shared/domain/status';

interface TaskListFilters {
  userId: number;
  date?: string;
  status?: TaskStatus;
  categoryId?: number;
}

export class TasksService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly categories: Pick<CategoryRepository, 'getById'>,
    private readonly focusSessions: Pick<FocusSessionRepository, 'getRunningByUser' | 'stop'>,
  ) {}

  list(filters: TaskListFilters) {
    return this.tasks.listByFilters({
      userId: filters.userId,
      plannedDate: filters.date,
      status: filters.status,
      categoryId: filters.categoryId,
    });
  }

  create(input: CreateTaskInput) {
    const title = input.title.trim();
    if (!title) {
      throw new AppError(400, 'Task title is required');
    }

    const category = this.categories.getById(input.categoryId, input.userId);
    if (!category) {
      throw new AppError(404, 'Category not found');
    }

    return this.tasks.create({
      ...input,
      title,
    });
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus) {
    if (!TASK_STATUSES.includes(status)) {
      throw new AppError(400, `Status must be one of: ${TASK_STATUSES.join(', ')}`);
    }

    const runningSession = this.focusSessions.getRunningByUser(userId);

    if (status === 'IN_PROGRESS') {
      if (!runningSession || runningSession.taskId !== taskId) {
        throw new AppError(409, 'Use the focus session start endpoint to mark a task as in progress.');
      }
    }

    if (runningSession && runningSession.taskId === taskId && status !== 'IN_PROGRESS') {
      this.focusSessions.stop({
        sessionId: runningSession.id,
        userId,
      });
    }

    const updated = this.tasks.updateStatus(taskId, userId, status);
    if (!updated) {
      throw new AppError(404, 'Task not found');
    }

    return updated;
  }

  delete(taskId: number, userId: number) {
    const removed = this.tasks.remove(taskId, userId);
    if (!removed) {
      throw new AppError(404, 'Task not found');
    }
  }
}
