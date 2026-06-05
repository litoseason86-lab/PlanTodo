import {isIsoDateString, toIsoDate} from '../../../shared/lib/date';
import {AppError} from '../errors/appError';

const ISO_DATE_ERROR_SUFFIX = 'must be a valid date in YYYY-MM-DD format';

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function parseRequiredIsoDate(value: unknown, fieldName: string, missingMessage: string): string {
  if (typeof value !== 'string' || !value) {
    throw new AppError(400, missingMessage);
  }

  if (!isIsoDateString(value)) {
    throw new AppError(400, `${fieldName} ${ISO_DATE_ERROR_SUFFIX}`);
  }

  return value;
}

export function parseOptionalIsoDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !isIsoDateString(value)) {
    throw new AppError(400, `${fieldName} ${ISO_DATE_ERROR_SUFFIX}`);
  }

  return value;
}
