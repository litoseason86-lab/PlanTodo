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
