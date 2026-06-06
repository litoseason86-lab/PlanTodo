import {addIsoDateDays} from '../../../../shared/lib/date';

export const TIMELINE_START_HOUR = 0;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_SLOT_MINUTES = 15;

const MINUTES_PER_HOUR = 60;
const CHINA_TIME_ZONE_OFFSET_MINUTES = 8 * MINUTES_PER_HOUR;
const TIME_ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export interface TimelineBlock {
  topMinutes: number;
  durationMinutes: number;
}

export interface TimedTaskSegment extends TimelineBlock {
  date: string;
  endMinutes: number;
  startsBeforeDate: boolean;
  continuesAfterDate: boolean;
  isFirstSegment: boolean;
  isLastSegment: boolean;
}

export interface TimedTaskDayLayoutInput extends TimedTaskBlockInput {
  taskId: number;
}

export interface TimedTaskDayLayoutSegment extends TimedTaskSegment {
  taskId: number;
  laneIndex: number;
  laneCount: number;
}

export interface TimedTaskBlockInput {
  startAt: string;
  endAt: string;
}

export interface FocusSessionBlockInput {
  startedAt: string;
  durationSeconds?: number;
}

export interface TimelineClockTime {
  hour: number;
  minute: number;
}

export interface TimelineDropClockTime extends TimelineClockTime {
  date: string;
}

export function minutesFromDayStart(value: string): number {
  return Number(value.slice(11, 13)) * MINUTES_PER_HOUR + Number(value.slice(14, 16));
}

export function buildTimedTaskBlock(task: TimedTaskBlockInput): TimelineBlock {
  const topMinutes = minutesFromDayStart(task.startAt);
  const endMinutes = minutesFromDayStart(task.endAt);

  return {
    topMinutes,
    durationMinutes: Math.max(TIMELINE_SLOT_MINUTES, endMinutes - topMinutes),
  };
}

function localDateFromDateTime(value: string): string {
  return value.slice(0, 10);
}

function localDateTimeMinuteValue(value: string): number {
  const date = localDateFromDateTime(value);
  const minutes = minutesFromDayStart(value);
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 60_000) + minutes;
}

function dateStartMinuteValue(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 60_000);
}

export function timedTaskDurationMinutes(task: TimedTaskBlockInput): number {
  return Math.max(TIMELINE_SLOT_MINUTES, localDateTimeMinuteValue(task.endAt) - localDateTimeMinuteValue(task.startAt));
}

export function buildTimedTaskSegments(input: {
  task: TimedTaskBlockInput;
  visibleDates: string[];
}): TimedTaskSegment[] {
  const startValue = localDateTimeMinuteValue(input.task.startAt);
  const endValue = localDateTimeMinuteValue(input.task.endAt);

  if (endValue <= startValue) {
    return [];
  }

  return input.visibleDates.flatMap((date) => {
    const dayStart = dateStartMinuteValue(date);
    const dayEnd = dateStartMinuteValue(addIsoDateDays(date, 1));
    const dateSegmentStart = Math.max(startValue, dayStart);
    const dateSegmentEnd = Math.min(endValue, dayEnd);

    if (dateSegmentEnd <= dateSegmentStart) {
      return [];
    }

    return [{
      date,
      topMinutes: dateSegmentStart - dayStart,
      endMinutes: dateSegmentEnd - dayStart,
      durationMinutes: Math.max(TIMELINE_SLOT_MINUTES, dateSegmentEnd - dateSegmentStart),
      startsBeforeDate: startValue < dayStart,
      continuesAfterDate: endValue > dayEnd,
      isFirstSegment: dateSegmentStart === startValue,
      isLastSegment: dateSegmentEnd === endValue,
    }];
  });
}

function segmentsOverlap(a: Pick<TimedTaskSegment, 'topMinutes' | 'endMinutes'>, b: Pick<TimedTaskSegment, 'topMinutes' | 'endMinutes'>): boolean {
  return a.topMinutes < b.endMinutes && b.topMinutes < a.endMinutes;
}

export function buildTimedTaskDayLayout(input: {
  date: string;
  tasks: TimedTaskDayLayoutInput[];
}): TimedTaskDayLayoutSegment[] {
  const segments = input.tasks.flatMap((task) => buildTimedTaskSegments({
    task,
    visibleDates: [input.date],
  }).map((segment) => ({
    ...segment,
    taskId: task.taskId,
  }))).sort((a, b) => a.topMinutes - b.topMinutes || a.endMinutes - b.endMinutes || a.taskId - b.taskId);

  const activeLanes: Array<TimedTaskDayLayoutSegment | undefined> = [];
  const laidOutSegments: TimedTaskDayLayoutSegment[] = [];

  for (const segment of segments) {
    for (let index = 0; index < activeLanes.length; index += 1) {
      const activeLane = activeLanes[index];
      if (activeLane && activeLane.endMinutes <= segment.topMinutes) {
        activeLanes[index] = undefined;
      }
    }

    const laneIndex = activeLanes.findIndex((activeSegment) => !activeSegment);
    const nextSegment: TimedTaskDayLayoutSegment = {
      ...segment,
      laneIndex: laneIndex === -1 ? activeLanes.length : laneIndex,
      laneCount: 1,
    };
    activeLanes[nextSegment.laneIndex] = nextSegment;
    laidOutSegments.push(nextSegment);
  }

  return laidOutSegments.map((segment) => {
    const laneCount = Math.max(
      1,
      ...laidOutSegments
        .filter((otherSegment) => segmentsOverlap(segment, otherSegment))
        .map((otherSegment) => otherSegment.laneIndex + 1),
    );

    return {
      ...segment,
      laneCount,
    };
  });
}

export function snapMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return 0;
  }

  return Math.round(minutes / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES;
}

export function getHourFromDropMinute(dropMinute: number): TimelineClockTime {
  const maxDropMinute = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * MINUTES_PER_HOUR
    + MINUTES_PER_HOUR
    - TIMELINE_SLOT_MINUTES;
  const snappedMinute = Math.min(Math.max(snapMinutes(dropMinute), 0), maxDropMinute);
  const minutesFromMidnight = TIMELINE_START_HOUR * MINUTES_PER_HOUR + snappedMinute;

  return {
    hour: Math.floor(minutesFromMidnight / MINUTES_PER_HOUR),
    minute: minutesFromMidnight % MINUTES_PER_HOUR,
  };
}

export function getTimelineDropClock(input: {
  date: string;
  hour: number;
  clientY: number;
  rectTop: number;
  rectHeight: number;
}): TimelineDropClockTime {
  if (!Number.isFinite(input.clientY) || !Number.isFinite(input.rectTop) || !Number.isFinite(input.rectHeight) || input.rectHeight <= 0) {
    return {date: input.date, hour: input.hour, minute: 0};
  }

  const minutesWithinHour = Math.min(
    MINUTES_PER_HOUR - TIMELINE_SLOT_MINUTES,
    Math.max(0, snapMinutes(((input.clientY - input.rectTop) / input.rectHeight) * MINUTES_PER_HOUR)),
  );

  return {
    date: input.date,
    hour: input.hour,
    minute: minutesWithinHour,
  };
}

export function buildFocusSessionBlock(session: FocusSessionBlockInput): TimelineBlock {
  return {
    topMinutes: minutesFromChinaDayStart(session.startedAt),
    durationMinutes: Math.max(TIMELINE_SLOT_MINUTES, Math.round((session.durationSeconds ?? 0) / 60)),
  };
}

function minutesFromChinaDayStart(value: string): number {
  if (!TIME_ZONE_SUFFIX_PATTERN.test(value)) {
    return minutesFromDayStart(value);
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const chinaDate = new Date(timestamp + CHINA_TIME_ZONE_OFFSET_MINUTES * 60_000);
  return chinaDate.getUTCHours() * MINUTES_PER_HOUR + chinaDate.getUTCMinutes();
}
