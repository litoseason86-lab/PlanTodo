import type {Task} from '../../../../shared/domain/entities';
import {addIsoDateDays, getWeekStart} from '../../../../shared/lib/date';
import {enumerateDateRange, taskIntersectsDateRange, toCanonicalTask} from '../../../../shared/lib/schedule';

export type CalendarView = 'month' | 'week' | 'list';

export interface CalendarDay {
  isoDate: string;
  isCurrentMonth: boolean;
}

export interface AllDaySegment {
  taskId: number;
  startsOn: string;
  endsOn: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function firstDayOfMonth(anchorDate: string): string {
  return `${anchorDate.slice(0, 7)}-01`;
}

function lastDayOfMonth(anchorDate: string): string {
  const [year, month] = anchorDate.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

export function buildWeekDays(anchorDate: string): CalendarDay[] {
  const start = getWeekStart(anchorDate);
  return Array.from({length: 7}, (_, index) => ({
    isoDate: addIsoDateDays(start, index),
    isCurrentMonth: true,
  }));
}

export function buildMonthGrid(anchorDate: string): CalendarDay[] {
  const first = firstDayOfMonth(anchorDate);
  const last = lastDayOfMonth(anchorDate);
  const gridStart = getWeekStart(first);
  const month = monthOf(anchorDate);
  const days: CalendarDay[] = [];

  for (
    let current = gridStart;
    days.length === 0 || days.length % 7 !== 0 || current <= last;
    current = addIsoDateDays(current, 1)
  ) {
    days.push({isoDate: current, isCurrentMonth: monthOf(current) === month});
  }

  return days;
}

export function getCalendarRange(view: CalendarView, anchorDate: string): {dateFrom: string; dateTo: string} {
  if (view === 'month') {
    return {dateFrom: firstDayOfMonth(anchorDate), dateTo: lastDayOfMonth(anchorDate)};
  }

  const week = buildWeekDays(anchorDate);
  return {dateFrom: week[0].isoDate, dateTo: week[6].isoDate};
}

export function groupTasksByDate(tasks: Task[], dateFrom: string, dateTo: string): Record<string, Task[]> {
  const groups = Object.fromEntries(enumerateDateRange(dateFrom, dateTo).map((date) => [date, [] as Task[]]));

  for (const rawTask of tasks) {
    const task = toCanonicalTask(rawTask);
    if (!taskIntersectsDateRange(task, dateFrom, dateTo)) {
      continue;
    }
    if (!task.plannedDate) {
      continue;
    }

    const startDate = task.startAt ? task.startAt.slice(0, 10) : task.plannedDate;
    const endDate = task.endAt ? task.endAt.slice(0, 10) : task.plannedEndDate ?? task.plannedDate;
    const visibleStart = startDate < dateFrom ? dateFrom : startDate;
    const visibleEnd = endDate > dateTo ? dateTo : endDate;

    for (const date of enumerateDateRange(visibleStart, visibleEnd)) {
      groups[date]?.push(task);
    }
  }

  return groups;
}

export function segmentAllDayTask(task: Task, dateFrom: string, dateTo: string): AllDaySegment {
  const canonical = toCanonicalTask(task);
  if (!canonical.plannedDate) {
    throw new Error('Cannot segment unscheduled task');
  }

  const startsOn = canonical.plannedDate < dateFrom ? dateFrom : canonical.plannedDate;
  const realEnd = canonical.plannedEndDate ?? canonical.plannedDate;
  const endsOn = realEnd > dateTo ? dateTo : realEnd;

  return {
    taskId: canonical.id,
    startsOn,
    endsOn,
    continuesBefore: canonical.plannedDate < dateFrom,
    continuesAfter: realEnd > dateTo,
  };
}
