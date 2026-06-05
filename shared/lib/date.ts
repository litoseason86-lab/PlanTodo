const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHINA_TIME_ZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDateParts(dateInput: string): {year: number; month: number; day: number} {
  const [year, month, day] = dateInput.split('-').map(Number);
  return {year, month, day};
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function toIsoDate(date: Date): string {
  return formatUtcDate(new Date(date.getTime() + CHINA_TIME_ZONE_OFFSET_MS));
}

export function addIsoDateDays(dateInput: string, days: number): string {
  const {year, month, day} = parseIsoDateParts(dateInput);
  const date = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);

  return formatUtcDate(date);
}

export function getIsoDateWeekday(dateInput: string): number {
  const {year, month, day} = parseIsoDateParts(dateInput);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getChinaDateUtcRange(dateInput: string): {startAt: string; endAt: string} {
  const {year, month, day} = parseIsoDateParts(dateInput);
  const startMs = Date.UTC(year, month - 1, day) - CHINA_TIME_ZONE_OFFSET_MS;

  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + DAY_MS - 1).toISOString(),
  };
}

export function getWeekStart(dateInput: string | Date): string {
  const isoDate = dateInput instanceof Date ? toIsoDate(dateInput) : dateInput;
  const weekday = getIsoDateWeekday(isoDate);
  const diff = weekday === 0 ? -6 : 1 - weekday;

  return addIsoDateDays(isoDate, diff);
}

export function isIsoDateString(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const {year, month, day} = parseIsoDateParts(value);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
