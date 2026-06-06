import {AppError} from '../../shared/errors/appError';
import {parseOptionalIsoDate} from '../../shared/http/dateParams';

export function parseTaskId(value: string): number {
  const taskId = Number.parseInt(value, 10);
  if (Number.isNaN(taskId)) {
    throw new AppError(400, 'Invalid task ID');
  }
  return taskId;
}

export function parseSessionId(value: string): number {
  const sessionId = Number.parseInt(value, 10);
  if (Number.isNaN(sessionId)) {
    throw new AppError(400, 'Invalid session ID');
  }
  return sessionId;
}

export function parseSessionDateQuery(value: unknown): string | undefined {
  return parseOptionalIsoDate(value, 'date');
}

export function parseSessionQuery(query: Record<string, unknown>): {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
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

  return {date, dateFrom, dateTo};
}
