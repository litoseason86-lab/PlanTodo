import {makeLocalDateTime} from '../../../../shared/lib/schedule';

export type WeekTimelineDensity = 'compact' | 'standard' | 'comfortable';

export const WEEK_TIMELINE_DENSITY_HEIGHTS: Record<WeekTimelineDensity, number> = {
  compact: 48,
  standard: 64,
  comfortable: 88,
};

export const MIN_TIMED_TASK_DURATION_MINUTES = 15;
export const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;
export const LATEST_TIMED_TASK_START_MINUTES = 23 * 60 + 44;
export const END_OF_DAY_MINUTES = 23 * 60 + 59;

export interface PopoverAnchor {
  x: number;
  y: number;
}

export type CalendarQuickCreateDraft =
  | {
      kind: 'timed';
      plannedDate: string;
      startAt: string;
      endAt: string;
      anchor: PopoverAnchor;
    }
  | {
      kind: 'all-day';
      plannedDate: string;
      plannedEndDate?: string;
      anchor: PopoverAnchor;
    };

export function hourHeightForDensity(density: WeekTimelineDensity): number {
  return WEEK_TIMELINE_DENSITY_HEIGHTS[density] ?? WEEK_TIMELINE_DENSITY_HEIGHTS.standard;
}

function snapMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.round(minutes / MIN_TIMED_TASK_DURATION_MINUTES) * MIN_TIMED_TASK_DURATION_MINUTES;
}

function clampStartMinute(minutes: number): number {
  return Math.min(Math.max(0, minutes), LATEST_TIMED_TASK_START_MINUTES);
}

function minuteFromPointer(input: {hour: number; clientY: number; rectTop: number; hourHeight: number}): number {
  const rawMinute = ((input.clientY - input.rectTop) / input.hourHeight) * 60;
  const minuteWithinHour = Math.min(45, Math.max(0, snapMinutes(rawMinute)));
  return clampStartMinute(input.hour * 60 + minuteWithinHour);
}

function makeDateTimeFromMinute(date: string, minuteOfDay: number): string {
  const clamped = Math.min(Math.max(0, minuteOfDay), END_OF_DAY_MINUTES);
  return makeLocalDateTime(date, Math.floor(clamped / 60), clamped % 60);
}

export function buildTimedQuickCreateDraftFromPoint(input: {
  date: string;
  hour: number;
  clientY: number;
  rectTop: number;
  hourHeight: number;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const startMinute = minuteFromPointer(input);
  const endMinute = Math.min(END_OF_DAY_MINUTES, startMinute + DEFAULT_TIMED_TASK_DURATION_MINUTES);
  const adjustedStart = endMinute - startMinute < MIN_TIMED_TASK_DURATION_MINUTES
    ? Math.max(0, endMinute - MIN_TIMED_TASK_DURATION_MINUTES)
    : startMinute;

  return {
    kind: 'timed',
    plannedDate: input.date,
    startAt: makeDateTimeFromMinute(input.date, adjustedStart),
    endAt: makeDateTimeFromMinute(input.date, endMinute),
    anchor: input.anchor,
  };
}

export function buildTimedQuickCreateDraftFromDrag(input: {
  date: string;
  startHour: number;
  startClientY: number;
  endHour: number;
  endClientY: number;
  startRectTop: number;
  endRectTop: number;
  hourHeight: number;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const startMinute = minuteFromPointer({
    hour: input.startHour,
    clientY: input.startClientY,
    rectTop: input.startRectTop,
    hourHeight: input.hourHeight,
  });
  const endMinute = minuteFromPointer({
    hour: input.endHour,
    clientY: input.endClientY,
    rectTop: input.endRectTop,
    hourHeight: input.hourHeight,
  });
  let rangeStart = Math.min(startMinute, endMinute);
  let rangeEnd = Math.max(startMinute, endMinute);
  if (rangeEnd - rangeStart < MIN_TIMED_TASK_DURATION_MINUTES) {
    rangeEnd = Math.min(END_OF_DAY_MINUTES, rangeStart + MIN_TIMED_TASK_DURATION_MINUTES);
  }
  if (rangeEnd > END_OF_DAY_MINUTES) {
    rangeEnd = END_OF_DAY_MINUTES;
    rangeStart = Math.min(rangeStart, LATEST_TIMED_TASK_START_MINUTES);
  }

  return {
    kind: 'timed',
    plannedDate: input.date,
    startAt: makeDateTimeFromMinute(input.date, rangeStart),
    endAt: makeDateTimeFromMinute(input.date, rangeEnd),
    anchor: input.anchor,
  };
}

export function buildAllDayQuickCreateDraft(input: {
  startDate: string;
  endDate: string;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const plannedDate = input.startDate <= input.endDate ? input.startDate : input.endDate;
  const plannedEndDate = input.startDate <= input.endDate ? input.endDate : input.startDate;
  return {
    kind: 'all-day',
    plannedDate,
    plannedEndDate: plannedEndDate === plannedDate ? undefined : plannedEndDate,
    anchor: input.anchor,
  };
}

export function getResizeDurationMinutes(input: {
  initialDurationMinutes: number;
  startY: number;
  currentY: number;
  hourHeight: number;
}): number {
  const minutesPerPixel = 60 / input.hourHeight;
  const deltaMinutes = snapMinutes((input.currentY - input.startY) * minutesPerPixel);
  return Math.max(MIN_TIMED_TASK_DURATION_MINUTES, input.initialDurationMinutes + deltaMinutes);
}

export function canResizeTimedTask(startAt: string): boolean {
  const hour = Number(startAt.slice(11, 13));
  const minute = Number(startAt.slice(14, 16));
  return hour * 60 + minute <= LATEST_TIMED_TASK_START_MINUTES;
}
