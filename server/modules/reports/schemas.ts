import {AppError} from '../../shared/errors/appError';
import {parseRequiredIsoDate} from '../../shared/http/dateParams';

export function parseDailyDate(value: unknown): string {
  return parseRequiredIsoDate(value, 'date', 'Query parameter "date" (YYYY-MM-DD) is required.');
}

export function parseDailyBodyDate(value: unknown): string {
  return parseRequiredIsoDate(value, 'date', 'Body parameter "date" (YYYY-MM-DD) is required.');
}

export function parseWeekStart(value: unknown, source: 'query' | 'body'): string {
  if (typeof value !== 'string' || !value) {
    throw new AppError(
      400,
      source === 'query'
        ? 'Query parameter "weekStart" (YYYY-MM-DD) is required.'
        : 'Body parameter "weekStart" (YYYY-MM-DD) is required.',
    );
  }
  return parseRequiredIsoDate(
    value,
    'weekStart',
    source === 'query'
      ? 'Query parameter "weekStart" (YYYY-MM-DD) is required.'
      : 'Body parameter "weekStart" (YYYY-MM-DD) is required.',
  );
}
