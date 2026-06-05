import {AppError} from '../../shared/errors/appError';
import {TASK_STATUSES, type TaskStatus} from '../../../shared/domain/status';

export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate: string;
}

export interface TaskStatusBody {
  status: TaskStatus;
}

export function parseTaskId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (Number.isNaN(id)) {
    throw new AppError(400, 'Invalid task ID');
  }
  return id;
}

export function parseTaskBody(body: unknown): TaskBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const categoryId = Number.parseInt(String(payload.categoryId), 10);
  if (Number.isNaN(categoryId)) {
    throw new AppError(400, 'Valid categoryId is required');
  }

  return {
    title: typeof payload.title === 'string' ? payload.title : '',
    categoryId,
    plannedDate:
      typeof payload.plannedDate === 'string'
        ? payload.plannedDate
        : new Date().toISOString().slice(0, 10),
  };
}

export function parseTaskStatusBody(body: unknown): TaskStatusBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const status = payload.status;
  if (typeof status !== 'string' || !TASK_STATUSES.includes(status as TaskStatus)) {
    throw new AppError(400, `Status must be one of: ${TASK_STATUSES.join(', ')}`);
  }

  return {
    status: status as TaskStatus,
  };
}

export function parseTaskQuery(query: Record<string, unknown>): {
  date?: string;
  status?: TaskStatus;
  categoryId?: number;
} {
  const categoryIdValue = query.categoryId;
  const parsedCategoryId =
    typeof categoryIdValue === 'string' ? Number.parseInt(categoryIdValue, 10) : undefined;

  return {
    date: typeof query.date === 'string' ? query.date : undefined,
    status: typeof query.status === 'string' && TASK_STATUSES.includes(query.status as TaskStatus)
      ? (query.status as TaskStatus)
      : undefined,
    categoryId:
      parsedCategoryId !== undefined && !Number.isNaN(parsedCategoryId)
        ? parsedCategoryId
        : undefined,
  };
}

