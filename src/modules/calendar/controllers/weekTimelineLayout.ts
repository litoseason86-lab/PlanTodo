export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_SLOT_MINUTES = 15;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const CHINA_TIME_ZONE_OFFSET_MINUTES = 8 * MINUTES_PER_HOUR;
const TIME_ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

export interface TimelineBlock {
  topMinutes: number;
  durationMinutes: number;
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

export function snapMinutes(minutes: number): number {
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
