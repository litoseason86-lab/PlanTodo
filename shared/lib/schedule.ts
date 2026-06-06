import type {Task} from '../domain/entities';
import {addIsoDateDays, isIsoDateString} from './date';

export type TaskScheduleKind = 'date' | 'cross-day' | 'timed';
export type LegacyTask = Omit<Task, 'allDay'> & {
  allDay?: boolean;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
};

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000$/;

export function isLocalDateTimeString(value: string): boolean {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    return false;
  }

  const date = value.slice(0, 10);
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));

  return isIsoDateString(date) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function makeLocalDateTime(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000`;
}

export function addMinutesToLocalDateTime(value: string, minutes: number): string {
  if (!isLocalDateTimeString(value)) {
    throw new Error('Invalid local datetime');
  }

  const date = value.slice(0, 10);
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const totalMinutes = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const minutesInDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);

  return makeLocalDateTime(addIsoDateDays(date, dayOffset), Math.floor(minutesInDay / 60), minutesInDay % 60);
}

export function getLocalDateFromDateTime(value: string): string {
  return value.slice(0, 10);
}

export function toCanonicalTask(task: LegacyTask): Task {
  const allDay = task.allDay ?? true;

  return {
    ...task,
    allDay,
    plannedEndDate: allDay ? task.plannedEndDate || undefined : undefined,
    startAt: allDay ? undefined : task.startAt || undefined,
    endAt: allDay ? undefined : task.endAt || undefined,
  };
}

export function getTaskScheduleKind(task: LegacyTask): TaskScheduleKind {
  const canonical = toCanonicalTask(task);
  if (!canonical.allDay && canonical.startAt && canonical.endAt) {
    return 'timed';
  }
  if (canonical.plannedEndDate && canonical.plannedEndDate !== canonical.plannedDate) {
    return 'cross-day';
  }
  return 'date';
}

export function taskIntersectsDateRange(task: LegacyTask, dateFrom: string, dateTo: string): boolean {
  const canonical = toCanonicalTask(task);
  const startDate = canonical.startAt ? getLocalDateFromDateTime(canonical.startAt) : canonical.plannedDate;
  const endDate = canonical.endAt
    ? getLocalDateFromDateTime(canonical.endAt)
    : canonical.plannedEndDate ?? canonical.plannedDate;

  return startDate <= dateTo && endDate >= dateFrom;
}

export function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  for (let date = dateFrom; date <= dateTo; date = addIsoDateDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
