import {AppError} from '../../shared/errors/appError';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from '../../../shared/domain/status';
import {parseOptionalIsoDate} from '../../shared/http/dateParams';
import {normalizeTaskSchedule, type NormalizedTaskSchedule} from './scheduleRules';

type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';
type PriorityFilter = TaskPriority | 'none';

export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  priority?: TaskPriority | null;
  tagIds: number[];
}

export interface TaskStatusBody {
  status: TaskStatus;
}

export interface TaskScheduleBody extends NormalizedTaskSchedule {}

export interface TaskDetailsBody {
  title: string;
  categoryId: number;
  tagIds: number[];
  priority: TaskPriority | null;
}

export interface TaskQueryParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
  scheduled?: ScheduledFilter;
  query?: string;
  priority?: PriorityFilter;
  tagIds?: number[];
}

export interface BatchScheduleBody {
  taskIds: number[];
  plannedDate: string;
}

export interface BatchUnscheduleBody {
  taskIds: number[];
}

export function parseTaskId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new AppError(400, 'Invalid task ID');
  }
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id)) {
    throw new AppError(400, 'Invalid task ID');
  }
  return id;
}

function parseTaskTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError(400, 'title is required');
  }
  const title = value.trim();
  if (!title) {
    throw new AppError(400, 'Task title is required');
  }
  return title;
}

function parseCategoryIdValue(value: unknown): number {
  const raw = typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
      ? value
      : '';
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new AppError(400, 'Invalid categoryId');
  }
  const categoryId = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(categoryId)) {
    throw new AppError(400, 'Invalid categoryId');
  }
  return categoryId;
}

function parsePriority(value: unknown): TaskPriority | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !TASK_PRIORITIES.includes(value as TaskPriority)) {
    throw new AppError(400, `priority must be one of: ${TASK_PRIORITIES.join(', ')}, null`);
  }
  return value as TaskPriority;
}

function parsePositiveInteger(value: unknown, field: string): number {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[1-9]\d*$/.test(value)
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, `${field} must contain positive integers`);
  }
  return id;
}

function parseQueryPriority(value: unknown): PriorityFilter | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    throw new AppError(400, 'priority must be provided once');
  }
  if (value === 'none') {
    return 'none';
  }
  if (typeof value !== 'string' || !TASK_PRIORITIES.includes(value as TaskPriority)) {
    throw new AppError(400, `priority must be one of: ${TASK_PRIORITIES.join(', ')}, none`);
  }
  return value as TaskPriority;
}

function parseTagIds(value: unknown, field = 'tagIds'): number[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, `${field} must be an array`);
  }

  const ids = value.map((item) => parsePositiveInteger(item, field));

  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, `${field} must be unique`);
  }
  return ids;
}

function parseQueryTagIds(value: unknown): number[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    throw new AppError(400, 'tagIds must be provided once');
  }
  if (typeof value !== 'string' || !/^[1-9]\d*(,[1-9]\d*)*$/.test(value)) {
    throw new AppError(400, 'tagIds must be a comma-separated list');
  }

  const ids = value.split(',').map((item) => parsePositiveInteger(item, 'tagIds'));
  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, 'tagIds must be unique');
  }
  return ids;
}

function parseQueryCategoryId(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    throw new AppError(400, 'categoryId must be provided once');
  }
  return parseCategoryIdValue(value);
}

function parseQueryStatus(value: unknown): TaskStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    throw new AppError(400, 'status must be provided once');
  }
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value as TaskStatus)) {
    throw new AppError(400, `Status must be one of: ${TASK_STATUSES.join(', ')}`);
  }
  return value as TaskStatus;
}

export function parseTaskBody(body: unknown): TaskBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const schedule = normalizeTaskSchedule(payload, {
    allowMissingPlannedDate: true,
    requireAllDay: false,
  });
  return {
    title: parseTaskTitle(payload.title),
    categoryId: parseCategoryIdValue(payload.categoryId),
    ...schedule,
    priority: parsePriority(payload.priority) ?? null,
    tagIds: parseTagIds(payload.tagIds),
  };
}

export function parseTaskDetailsBody(body: unknown): TaskDetailsBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  if (!Object.hasOwn(payload, 'title')) {
    throw new AppError(400, 'title is required');
  }
  if (!Object.hasOwn(payload, 'categoryId')) {
    throw new AppError(400, 'categoryId is required');
  }
  if (!Object.hasOwn(payload, 'tagIds')) {
    throw new AppError(400, 'tagIds is required');
  }
  if (!Object.hasOwn(payload, 'priority')) {
    throw new AppError(400, 'priority is required');
  }

  return {
    title: parseTaskTitle(payload.title),
    categoryId: parseCategoryIdValue(payload.categoryId),
    tagIds: parseTagIds(payload.tagIds),
    priority: parsePriority(payload.priority) ?? null,
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

export function parseTaskQuery(query: Record<string, unknown>): TaskQueryParams {
  const date = parseOptionalIsoDate(query.date, 'date');
  const dateFrom = parseOptionalIsoDate(query.dateFrom, 'dateFrom');
  const dateTo = parseOptionalIsoDate(query.dateTo, 'dateTo');

  if (date && (dateFrom || dateTo)) {
    throw new AppError(400, 'Use either date or dateFrom/dateTo');
  }
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw new AppError(400, 'dateFrom and dateTo must be provided together');
  }
  if (dateFrom && dateTo && dateTo < dateFrom) {
    throw new AppError(400, 'dateTo must be after dateFrom');
  }

  const scheduled = typeof query.scheduled === 'string' ? query.scheduled : undefined;
  if (scheduled && !['unscheduled', 'scheduled', 'all-day-without-time'].includes(scheduled)) {
    throw new AppError(400, 'scheduled must be one of: unscheduled, scheduled, all-day-without-time');
  }
  if (scheduled === 'unscheduled' && (date || dateFrom || dateTo)) {
    throw new AppError(400, 'scheduled=unscheduled cannot be combined with date filters');
  }
  const trimmedQuery = typeof query.query === 'string' ? query.query.trim() : undefined;

  return {
    date,
    dateFrom,
    dateTo,
    status: parseQueryStatus(query.status),
    categoryId: parseQueryCategoryId(query.categoryId),
    scheduled: scheduled as ScheduledFilter | undefined,
    query: trimmedQuery || undefined,
    priority: parseQueryPriority(query.priority),
    tagIds: parseQueryTagIds(query.tagIds),
  };
}

export function parseTaskScheduleBody(body: unknown): TaskScheduleBody {
  return normalizeTaskSchedule((body ?? {}) as Record<string, unknown>, {
    allowMissingPlannedDate: false,
    requireAllDay: true,
  });
}

function parseTaskIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, 'taskIds must be a non-empty array');
  }

  const taskIds = value.map((item) => {
    const id = typeof item === 'number'
      ? item
      : typeof item === 'string' && /^[1-9]\d*$/.test(item)
        ? Number.parseInt(item, 10)
        : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, 'taskIds must contain positive integers');
    }
    return id;
  });

  if (new Set(taskIds).size !== taskIds.length) {
    throw new AppError(400, 'taskIds must be unique');
  }

  return taskIds;
}

export function parseBatchScheduleBody(body: unknown): BatchScheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const plannedDate = parseOptionalIsoDate(payload.plannedDate, 'plannedDate');
  if (!plannedDate) {
    throw new AppError(400, 'Invalid plannedDate');
  }
  return {
    taskIds: parseTaskIds(payload.taskIds),
    plannedDate,
  };
}

export function parseBatchUnscheduleBody(body: unknown): BatchUnscheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  return {
    taskIds: parseTaskIds(payload.taskIds),
  };
}
