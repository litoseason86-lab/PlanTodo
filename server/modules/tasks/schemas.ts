import {AppError} from '../../shared/errors/appError';
import {TASK_STATUSES, type TaskStatus} from '../../../shared/domain/status';
import {parseOptionalIsoDate} from '../../shared/http/dateParams';
import {isLocalDateTimeString} from '../../../shared/lib/schedule';

type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';

export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface TaskStatusBody {
  status: TaskStatus;
}

export interface TaskScheduleBody {
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export interface TaskQueryParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
  scheduled?: ScheduledFilter;
  query?: string;
}

export interface BatchScheduleBody {
  taskIds: number[];
  plannedDate: string;
}

export interface BatchUnscheduleBody {
  taskIds: number[];
}

function parseOptionalLocalDateTime(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !isLocalDateTimeString(value)) {
    throw new AppError(400, `${fieldName} must be a local ISO datetime without timezone`);
  }
  return value;
}

function parseNullableIsoDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parseOptionalIsoDate(value, fieldName);
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new AppError(400, `${fieldName} must be a boolean`);
  }
  return value;
}

function assertScheduleBodyRules(body: TaskScheduleBody): void {
  if (!body.plannedDate) {
    if (!body.allDay) {
      throw new AppError(400, 'Timed task requires plannedDate');
    }
    return;
  }
  if (body.plannedEndDate && body.plannedEndDate < body.plannedDate) {
    throw new AppError(400, 'plannedEndDate must be after plannedDate');
  }
  if (!body.allDay && (!body.startAt || !body.endAt)) {
    throw new AppError(400, 'Timed task requires startAt and endAt');
  }
  if (body.startAt && body.endAt && body.endAt <= body.startAt) {
    throw new AppError(400, 'endAt must be after startAt');
  }
  if (
    !body.allDay &&
    body.startAt?.slice(0, 10) !== body.plannedDate
  ) {
    throw new AppError(400, 'Timed task date must match plannedDate');
  }
  if (!body.allDay && body.endAt?.slice(0, 10) !== body.plannedDate) {
    throw new AppError(400, 'Cross-day timed tasks are not supported yet');
  }
}

function normalizeSchedulePayload(payload: Record<string, unknown>, requireAllDay: boolean): TaskScheduleBody {
  const hasPlannedDateField = Object.prototype.hasOwnProperty.call(payload, 'plannedDate');
  const hasScheduleDetails = [payload.plannedEndDate, payload.startAt, payload.endAt].some((value) => {
    return value !== undefined && value !== null && value !== '';
  });
  const plannedDate = parseNullableIsoDate(payload.plannedDate, 'plannedDate');
  const requestedAllDay = parseOptionalBoolean(payload.allDay, 'allDay');

  if (!plannedDate) {
    if (requestedAllDay === false || (!hasPlannedDateField && hasScheduleDetails)) {
      throw new AppError(400, 'Timed task requires plannedDate');
    }
    return {
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    };
  }

  const startAt = parseOptionalLocalDateTime(payload.startAt, 'startAt');
  const endAt = parseOptionalLocalDateTime(payload.endAt, 'endAt');
  const allDay = requestedAllDay ?? !(startAt && endAt);

  if (requireAllDay && requestedAllDay === undefined) {
    throw new AppError(400, 'allDay must be a boolean');
  }

  const schedule: TaskScheduleBody = {
    plannedDate,
    plannedEndDate: allDay ? parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate') : undefined,
    startAt: allDay ? undefined : startAt,
    endAt: allDay ? undefined : endAt,
    allDay,
  };
  assertScheduleBodyRules(schedule);
  return schedule;
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

  const schedule = normalizeSchedulePayload(payload, false);
  return {
    title: typeof payload.title === 'string' ? payload.title : '',
    categoryId,
    ...schedule,
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

  const categoryIdValue = query.categoryId;
  const parsedCategoryId =
    typeof categoryIdValue === 'string' ? Number.parseInt(categoryIdValue, 10) : undefined;
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
    status: typeof query.status === 'string' && TASK_STATUSES.includes(query.status as TaskStatus)
      ? (query.status as TaskStatus)
      : undefined,
    categoryId:
      parsedCategoryId !== undefined && !Number.isNaN(parsedCategoryId)
        ? parsedCategoryId
        : undefined,
    scheduled: scheduled as ScheduledFilter | undefined,
    query: trimmedQuery || undefined,
  };
}

export function parseTaskScheduleBody(body: unknown): TaskScheduleBody {
  return normalizeSchedulePayload((body ?? {}) as Record<string, unknown>, true);
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
