import {AppError} from '../../shared/errors/appError';
import {TASK_STATUSES, type TaskStatus} from '../../../shared/domain/status';
import {parseOptionalIsoDate, todayIsoDate} from '../../shared/http/dateParams';
import {isLocalDateTimeString} from '../../../shared/lib/schedule';

export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface TaskStatusBody {
  status: TaskStatus;
}

export interface TaskScheduleBody {
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

function parseOptionalLocalDateTime(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !isLocalDateTimeString(value)) {
    throw new AppError(400, `${fieldName} must be a local ISO datetime without timezone`);
  }
  return value;
}

function assertScheduleBodyRules(body: TaskScheduleBody): void {
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

  const plannedDate =
    typeof payload.plannedDate === 'string'
      ? parseOptionalIsoDate(payload.plannedDate, 'plannedDate')!
      : todayIsoDate();
  const plannedEndDate = parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate');
  const startAt = parseOptionalLocalDateTime(payload.startAt, 'startAt');
  const endAt = parseOptionalLocalDateTime(payload.endAt, 'endAt');
  const allDay = typeof payload.allDay === 'boolean' ? payload.allDay : !(startAt && endAt);

  const taskBody = {
    title: typeof payload.title === 'string' ? payload.title : '',
    categoryId,
    plannedDate,
    plannedEndDate: allDay ? plannedEndDate : undefined,
    startAt: allDay ? undefined : startAt,
    endAt: allDay ? undefined : endAt,
    allDay,
  };
  assertScheduleBodyRules({...taskBody, allDay});
  return taskBody;
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
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
} {
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
  };
}

export function parseTaskScheduleBody(body: unknown): TaskScheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const plannedDate = parseOptionalIsoDate(payload.plannedDate, 'plannedDate');
  if (!plannedDate) {
    throw new AppError(400, 'Invalid plannedDate');
  }

  if (typeof payload.allDay !== 'boolean') {
    throw new AppError(400, 'allDay must be a boolean');
  }
  const allDay = payload.allDay;
  const schedule: TaskScheduleBody = {
    plannedDate,
    plannedEndDate: allDay ? parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate') : undefined,
    startAt: allDay ? undefined : parseOptionalLocalDateTime(payload.startAt, 'startAt'),
    endAt: allDay ? undefined : parseOptionalLocalDateTime(payload.endAt, 'endAt'),
    allDay,
  };

  assertScheduleBodyRules(schedule);
  return schedule;
}
