import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';

const MINUTES_PER_DAY = 24 * 60;
const MINIMUM_GAP_MINUTES = 15;

export interface TodayTimedTaskInput {
  id: number;
  title: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  status: TaskStatus;
}

export interface TodayTimelineTaskItem {
  type: 'task';
  taskId: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

export interface TodayTimelineGapItem {
  type: 'gap';
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

export type TodayTimelineFlowItem = TodayTimelineTaskItem | TodayTimelineGapItem;

interface BuildTodayTimelineFlowInput {
  date: string;
  tasks: TodayTimedTaskInput[];
}

interface PartitionTodayExecutionTasksInput {
  date: string;
  tasks: Task[];
}

export interface TodayExecutionTaskPartition {
  timelineFlow: TodayTimelineFlowItem[];
  taskQueue: Task[];
}

interface VisibleTaskSegment extends TodayTimelineTaskItem {
  task: TodayTimedTaskInput;
}

interface MinuteRange {
  startMinutes: number;
  endMinutes: number;
}

function dateDayIndex(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const value = Date.UTC(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(value)) {
    return null;
  }

  return Math.floor(value / 86_400_000);
}

function localDateTimeMinuteValue(value: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const [, date, hour, minute] = match;
  const dayIndex = dateDayIndex(date);
  const hourValue = Number(hour);
  const minuteValue = Number(minute);

  if (
    dayIndex === null ||
    hourValue < 0 ||
    hourValue > 23 ||
    minuteValue < 0 ||
    minuteValue > 59
  ) {
    return null;
  }

  return dayIndex * MINUTES_PER_DAY + hourValue * 60 + minuteValue;
}

function visibleTaskSegment(date: string, task: TodayTimedTaskInput): VisibleTaskSegment | null {
  if (task.allDay || !task.startAt || !task.endAt) {
    return null;
  }

  const dayIndex = dateDayIndex(date);
  const startValue = localDateTimeMinuteValue(task.startAt);
  const endValue = localDateTimeMinuteValue(task.endAt);

  if (dayIndex === null || startValue === null || endValue === null || endValue <= startValue) {
    return null;
  }

  const dayStart = dayIndex * MINUTES_PER_DAY;
  const dayEnd = dayStart + MINUTES_PER_DAY;
  const clippedStart = Math.max(startValue, dayStart);
  const clippedEnd = Math.min(endValue, dayEnd);

  if (clippedEnd <= clippedStart) {
    return null;
  }

  const startMinutes = clippedStart - dayStart;
  const endMinutes = clippedEnd - dayStart;

  return {
    type: 'task',
    taskId: task.id,
    startMinutes,
    endMinutes,
    durationMinutes: endMinutes - startMinutes,
    task,
  };
}

function compareFlowItems(left: TodayTimelineFlowItem, right: TodayTimelineFlowItem): number {
  if (left.startMinutes !== right.startMinutes) {
    return left.startMinutes - right.startMinutes;
  }

  if (left.type !== right.type) {
    return left.type === 'task' ? -1 : 1;
  }

  if (left.endMinutes !== right.endMinutes) {
    return left.endMinutes - right.endMinutes;
  }

  const leftTaskId = left.type === 'task' ? left.taskId : Number.MAX_SAFE_INTEGER;
  const rightTaskId = right.type === 'task' ? right.taskId : Number.MAX_SAFE_INTEGER;

  return leftTaskId - rightTaskId;
}

function mergeRanges(segments: VisibleTaskSegment[]): MinuteRange[] {
  const ranges = segments
    .map((segment) => ({
      startMinutes: segment.startMinutes,
      endMinutes: segment.endMinutes,
    }))
    .sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) {
        return left.startMinutes - right.startMinutes;
      }

      return left.endMinutes - right.endMinutes;
    });

  return ranges.reduce<MinuteRange[]>((merged, range) => {
    const previous = merged.at(-1);

    if (!previous || range.startMinutes > previous.endMinutes) {
      merged.push({...range});
      return merged;
    }

    previous.endMinutes = Math.max(previous.endMinutes, range.endMinutes);
    return merged;
  }, []);
}

function buildFlowFromSegments(segments: VisibleTaskSegment[]): TodayTimelineFlowItem[] {
  if (segments.length === 0) {
    return [];
  }

  const mergedRanges = mergeRanges(segments);
  const gaps: TodayTimelineGapItem[] = [];

  for (let index = 1; index < mergedRanges.length; index += 1) {
    const previous = mergedRanges[index - 1];
    const current = mergedRanges[index];
    const durationMinutes = current.startMinutes - previous.endMinutes;

    if (durationMinutes >= MINIMUM_GAP_MINUTES) {
      gaps.push({
        type: 'gap',
        startMinutes: previous.endMinutes,
        endMinutes: current.startMinutes,
        durationMinutes,
      });
    }
  }

  return [
    ...segments.map(({task: _task, ...item}) => item),
    ...gaps,
  ].sort(compareFlowItems);
}

function extractVisibleTaskSegments(date: string, tasks: TodayTimedTaskInput[]): VisibleTaskSegment[] {
  return tasks
    .map((task) => visibleTaskSegment(date, task))
    .filter((segment): segment is VisibleTaskSegment => segment !== null);
}

export function buildTodayTimelineFlow({
  date,
  tasks,
}: BuildTodayTimelineFlowInput): TodayTimelineFlowItem[] {
  return buildFlowFromSegments(extractVisibleTaskSegments(date, tasks));
}

export function partitionTodayExecutionTasks({
  date,
  tasks,
}: PartitionTodayExecutionTasksInput): TodayExecutionTaskPartition {
  const visibleSegments = extractVisibleTaskSegments(date, tasks);
  const timelineTaskIds = new Set(visibleSegments.map((segment) => segment.taskId));

  return {
    timelineFlow: buildFlowFromSegments(visibleSegments),
    taskQueue: tasks.filter((task) => !timelineTaskIds.has(task.id)),
  };
}
