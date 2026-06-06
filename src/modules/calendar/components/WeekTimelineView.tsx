import {useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {toIsoDate} from '../../../../shared/lib/date';
import {focusSessionDurationMinutes, isCountedFocusSession} from '../../../../shared/lib/focusSessions';
import {buildWeekAllDaySegments, buildWeekDays} from '../controllers/calendarLayout';
import {
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  buildTimedTaskDayLayout,
  getTimelineDropClock,
  timedTaskDurationMinutes,
  type TimedTaskDayLayoutSegment,
} from '../controllers/weekTimelineLayout';
import {
  buildAllDayQuickCreateDraft,
  buildTimedQuickCreateDraftFromDrag,
  buildTimedQuickCreateDraftFromPoint,
  canResizeTimedTask,
  getResizeDurationMinutes,
  hourHeightForDensity,
  type CalendarQuickCreateDraft,
  type WeekTimelineDensity,
} from '../controllers/weekTimelineInteraction';
import {readCalendarDragPayload, writeCalendarDragPayload} from '../controllers/schedulingDrag';

const HOURS = Array.from({length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1}, (_, index) => index + TIMELINE_START_HOUR);
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const TIMELINE_LANE_GAP_PX = 4;
const ALL_DAY_LABEL_WIDTH_PX = 64;
const ALL_DAY_HEADER_TOP_OFFSET_PX = 32;
const ALL_DAY_SEGMENT_ROW_HEIGHT_PX = 28;
const ALL_DAY_SEGMENT_ROW_GAP_PX = 4;

interface WeekTimelineViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
  focusSessions: TaskExecutionSession[];
  showFocusSessions: boolean;
  onScheduleDate: (taskId: number, date: string) => Promise<boolean>;
  onBatchScheduleDate: (taskIds: number[], date: string) => Promise<boolean>;
  onScheduleTime: (input: {taskId: number; date: string; hour: number; minute: number}) => Promise<boolean>;
  onMoveTimedTask: (input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}) => Promise<boolean>;
  onResizeTimedTask: (input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}) => Promise<boolean>;
  onRejectBatchTimeDrop: () => void;
  enableQuickCreate?: boolean;
  weekTimelineDensity?: WeekTimelineDensity;
  onOpenQuickCreate?: (draft: CalendarQuickCreateDraft) => void;
}

interface ResizeState {
  taskId: number;
  plannedDate: string;
  startAt: string;
  initialDurationMinutes: number;
  startY: number;
}

interface TimeQuickCreatePointerState {
  date: string;
  hour: number;
  clientX: number;
  clientY: number;
  rectTop: number;
}

interface AllDayQuickCreatePointerState {
  startDate: string;
  anchor: {x: number; y: number};
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

function taskDurationMinutes(task: Task): number | undefined {
  if (!task.startAt || !task.endAt) {
    return undefined;
  }
  return timedTaskDurationMinutes({startAt: task.startAt, endAt: task.endAt});
}

function formatTimelineClock(minutes: number): string {
  const clampedMinutes = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY);
  if (clampedMinutes === MINUTES_PER_DAY) {
    return '24:00';
  }

  const hour = Math.floor(clampedMinutes / MINUTES_PER_HOUR);
  const minute = clampedMinutes % MINUTES_PER_HOUR;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function taskSegmentLabel(task: Task, segment: TimedTaskDayLayoutSegment): string {
  return `${taskSegmentTimeLabel(segment)} ${task.title}`;
}

function taskSegmentTimeLabel(segment: TimedTaskDayLayoutSegment): string {
  const start = formatTimelineClock(segment.topMinutes);
  const end = formatTimelineClock(segment.endMinutes);
  return `${start}-${end}`;
}

function timelineColumnBlockStyle(segment: TimedTaskDayLayoutSegment) {
  return {
    top: `${(segment.topMinutes / MINUTES_PER_DAY) * 100}%`,
    height: `${Math.min(100, (segment.durationMinutes / MINUTES_PER_DAY) * 100)}%`,
    minHeight: '24px',
  };
}

function timelineLaneStyle(segment: TimedTaskDayLayoutSegment) {
  if (segment.laneCount <= 1) {
    return {
      left: '0%',
      width: '100%',
    };
  }

  const totalGapPx = (segment.laneCount - 1) * TIMELINE_LANE_GAP_PX;
  const width = `calc((100% - ${totalGapPx}px) / ${segment.laneCount})`;
  return {
    left: `calc((${width} + ${TIMELINE_LANE_GAP_PX}px) * ${segment.laneIndex})`,
    width,
  };
}

function focusDate(session: TaskExecutionSession): string {
  return toIsoDate(new Date(session.startedAt));
}

function focusMinutes(session: TaskExecutionSession): number {
  return focusSessionDurationMinutes(session);
}

function focusMinutesForTaskDate(input: {
  focusSessions: TaskExecutionSession[];
  taskId: number;
  date: string;
}): number {
  return input.focusSessions
    .filter(isCountedFocusSession)
    .filter((session) => session.taskId === input.taskId && focusDate(session) === input.date)
    .reduce((sum, session) => sum + focusMinutes(session), 0);
}

function taskSegmentAriaLabel(input: {
  task: Task;
  segment: TimedTaskDayLayoutSegment;
  focusMinutes: number;
}): string {
  const focusLabel = input.focusMinutes > 0 ? `，专注 ${input.focusMinutes}m` : '';
  return `${input.segment.date} ${taskSegmentLabel(input.task, input.segment)}${focusLabel}`;
}

function getAllDayDropDate(input: {
  clientX: number;
  days: {isoDate: string}[];
  layerElement: HTMLElement;
}): string {
  const rect = input.layerElement.getBoundingClientRect();
  const dayWidth = Math.max(1, (rect.width - ALL_DAY_LABEL_WIDTH_PX) / input.days.length);
  const rawIndex = Math.floor((input.clientX - rect.left - ALL_DAY_LABEL_WIDTH_PX) / dayWidth);
  const dayIndex = Math.min(input.days.length - 1, Math.max(0, rawIndex));

  return input.days[dayIndex].isoDate;
}

export function WeekTimelineView({
  anchorDate,
  tasksByDate,
  categories,
  focusSessions,
  showFocusSessions,
  onScheduleDate,
  onBatchScheduleDate,
  onScheduleTime,
  onMoveTimedTask,
  onResizeTimedTask,
  onRejectBatchTimeDrop,
  enableQuickCreate = false,
  weekTimelineDensity = 'standard',
  onOpenQuickCreate = () => {},
}: WeekTimelineViewProps) {
  const days = buildWeekDays(anchorDate);
  const hourHeight = hourHeightForDensity(weekTimelineDensity);
  const weekDateFrom = days[0].isoDate;
  const weekDateTo = days[days.length - 1].isoDate;
  const allDayTaskById = new Map<number, Task>();

  for (const day of days) {
    for (const task of tasksByDate[day.isoDate] ?? []) {
      if (task.allDay === true && task.plannedDate && !allDayTaskById.has(task.id)) {
        allDayTaskById.set(task.id, task);
      }
    }
  }

  const allDayTasks = [...allDayTaskById.values()];
  const allDaySegments = buildWeekAllDaySegments({
    dateFrom: weekDateFrom,
    dateTo: weekDateTo,
    tasks: allDayTasks,
  });
  const allDayRowCount = Math.max(1, ...allDaySegments.map((segment) => segment.rowIndex + 1));
  const allDayHeaderMinHeight = (
    ALL_DAY_HEADER_TOP_OFFSET_PX +
    allDayRowCount * ALL_DAY_SEGMENT_ROW_HEIGHT_PX +
    Math.max(0, allDayRowCount - 1) * ALL_DAY_SEGMENT_ROW_GAP_PX +
    8
  );
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const timeQuickCreatePointerRef = useRef<TimeQuickCreatePointerState | null>(null);
  const allDayQuickCreatePointerRef = useRef<AllDayQuickCreatePointerState | null>(null);

  const handleAllDayDrop = (event: DragEvent<HTMLElement>, date: string) => {
    event.preventDefault();
    allDayQuickCreatePointerRef.current = null;
    const payload = readCalendarDragPayload(event.dataTransfer);
    if (!payload) return;
    if (payload.type === 'calendar-task-batch') {
      void onBatchScheduleDate(payload.taskIds, date);
      return;
    }
    void onScheduleDate(payload.taskId, date);
  };

  const handleAllDayPointerDown = (event: ReactPointerEvent<HTMLElement>, date: string) => {
    if (!enableQuickCreate || event.button > 0) {
      return;
    }
    allDayQuickCreatePointerRef.current = {
      startDate: date,
      anchor: {x: event.clientX, y: event.clientY},
    };
  };

  const handleAllDayPointerUp = (date: string) => {
    const pointer = allDayQuickCreatePointerRef.current;
    if (!enableQuickCreate || !pointer) {
      return;
    }
    onOpenQuickCreate(buildAllDayQuickCreateDraft({
      startDate: pointer.startDate,
      endDate: date,
      anchor: pointer.anchor,
    }));
    allDayQuickCreatePointerRef.current = null;
  };

  const handleTimeSlotPointerDown = (event: ReactPointerEvent<HTMLElement>, date: string, hour: number) => {
    if (!enableQuickCreate || event.button > 0) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    timeQuickCreatePointerRef.current = {
      date,
      hour,
      clientX: event.clientX,
      clientY: event.clientY,
      rectTop: rect.top,
    };
  };

  const handleTimeSlotPointerUp = (event: ReactPointerEvent<HTMLElement>, date: string, hour: number) => {
    const pointer = timeQuickCreatePointerRef.current;
    if (!enableQuickCreate || !pointer || pointer.date !== date) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const isPointCreate = (
      pointer.hour === hour &&
      Math.abs(event.clientY - pointer.clientY) < 4
    );
    const draft = isPointCreate
      ? buildTimedQuickCreateDraftFromPoint({
        date,
        hour,
        clientY: event.clientY,
        rectTop: rect.top,
        hourHeight,
        anchor: {x: pointer.clientX, y: pointer.clientY},
      })
      : buildTimedQuickCreateDraftFromDrag({
        date,
        startHour: pointer.hour,
        startClientY: pointer.clientY,
        endHour: hour,
        endClientY: event.clientY,
        startRectTop: pointer.rectTop,
        endRectTop: rect.top,
        hourHeight,
        anchor: {x: pointer.clientX, y: pointer.clientY},
      });

    onOpenQuickCreate(draft);
    timeQuickCreatePointerRef.current = null;
  };

  useEffect(() => {
    if (!resizeState) {
      return undefined;
    }

    const onPointerUp = (event: PointerEvent) => {
      const durationMinutes = getResizeDurationMinutes({
        initialDurationMinutes: resizeState.initialDurationMinutes,
        startY: resizeState.startY,
        currentY: event.clientY,
        hourHeight,
      });
      void onResizeTimedTask({
        taskId: resizeState.taskId,
        plannedDate: resizeState.plannedDate,
        startAt: resizeState.startAt,
        durationMinutes,
      });
      setResizeState(null);
    };

    window.addEventListener('pointerup', onPointerUp, {once: true});

    return () => {
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [hourHeight, onResizeTimedTask, resizeState]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative border-b border-slate-200">
        <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="p-2 text-xs font-bold text-slate-400" style={{minHeight: allDayHeaderMinHeight}}>
            全天
          </div>
          {days.map((day) => (
            <div
              key={day.isoDate}
              aria-label={`${day.isoDate} 全天`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleAllDayDrop(event, day.isoDate)}
              onPointerDown={(event) => handleAllDayPointerDown(event, day.isoDate)}
              onPointerUp={() => handleAllDayPointerUp(day.isoDate)}
              className="border-l border-slate-100 p-2"
              style={{minHeight: allDayHeaderMinHeight}}
            >
              <div className="text-xs font-bold text-slate-500">{day.isoDate.slice(5)}</div>
            </div>
          ))}
        </div>
        <div
          data-week-all-day-layer="true"
          className="pointer-events-none absolute inset-x-0 grid grid-cols-[64px_repeat(7,minmax(0,1fr))] px-1"
          style={{
            top: ALL_DAY_HEADER_TOP_OFFSET_PX,
            gridTemplateRows: `repeat(${allDayRowCount}, minmax(${ALL_DAY_SEGMENT_ROW_HEIGHT_PX}px, auto))`,
            rowGap: ALL_DAY_SEGMENT_ROW_GAP_PX,
          }}
        >
          {allDaySegments.map((segment) => {
            const task = allDayTaskById.get(segment.taskId);
            if (!task) {
              return null;
            }

            return (
              <div
                key={`${segment.taskId}-${segment.startsOn}-${segment.endsOn}`}
                draggable
                aria-label={`${segment.startsOn} 至 ${segment.endsOn} ${task.title}`}
                onDragStart={(event) => writeCalendarDragPayload(event.dataTransfer, {type: 'calendar-task', taskId: task.id, source: 'calendar'})}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const layerElement = event.currentTarget.parentElement;
                  if (!layerElement) {
                    handleAllDayDrop(event, segment.startsOn);
                    return;
                  }
                  handleAllDayDrop(event, getAllDayDropDate({
                    clientX: event.clientX,
                    days,
                    layerElement,
                  }));
                }}
                className="pointer-events-auto mx-1 truncate rounded px-2 py-1 text-[11px] font-bold text-white shadow-sm"
                style={{
                  gridColumn: `${segment.startIndex + 2} / span ${segment.span}`,
                  gridRow: segment.rowIndex + 1,
                  backgroundColor: categoryColor(categories, task.categoryId),
                }}
              >
                {task.title}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-b border-slate-100 p-2 text-xs font-semibold text-slate-400"
              style={{height: hourHeight}}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const timedTasks = (tasksByDate[day.isoDate] ?? [])
            .filter((task): task is Task & {plannedDate: string; startAt: string; endAt: string} => {
              return !task.allDay && Boolean(task.plannedDate && task.startAt && task.endAt);
            });
          const taskById = new Map(timedTasks.map((task) => [task.id, task]));
          const taskSegments = buildTimedTaskDayLayout({
            date: day.isoDate,
            tasks: timedTasks.map((task) => ({
              taskId: task.id,
              startAt: task.startAt,
              endAt: task.endAt,
            })),
          });

          return (
            <div key={day.isoDate} className="relative border-l border-slate-100">
              {HOURS.map((hour) => (
                <div
                  key={`${day.isoDate}-${hour}`}
                  aria-label={`${day.isoDate} ${String(hour).padStart(2, '0')}:00`}
                  onPointerDown={(event) => handleTimeSlotPointerDown(event, day.isoDate, hour)}
                  onPointerUp={(event) => handleTimeSlotPointerUp(event, day.isoDate, hour)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    timeQuickCreatePointerRef.current = null;
                    event.preventDefault();
                    const payload = readCalendarDragPayload(event.dataTransfer);
                    if (!payload) {
                      return;
                    }
                    if (payload.type === 'calendar-task-batch') {
                      onRejectBatchTimeDrop();
                      return;
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    const clock = getTimelineDropClock({
                      date: day.isoDate,
                      hour,
                      clientY: event.clientY,
                      rectTop: rect.top,
                      rectHeight: rect.height,
                    });
                    if (payload.type === 'calendar-timed-task') {
                      void onMoveTimedTask({
                        taskId: payload.taskId,
                        date: clock.date,
                        hour: clock.hour,
                        minute: clock.minute,
                        durationMinutes: payload.durationMinutes,
                      });
                      return;
                    }
                    void onScheduleTime({taskId: payload.taskId, date: clock.date, hour: clock.hour, minute: clock.minute});
                  }}
                  className="border-b border-slate-100"
                  style={{height: hourHeight}}
                />
              ))}
              <div className="pointer-events-none absolute inset-0">
                {taskSegments.map((segment) => {
                  const task = taskById.get(segment.taskId);
                  if (!task) {
                    return null;
                  }
                  const taskFocusMinutes = showFocusSessions
                    ? focusMinutesForTaskDate({focusSessions, taskId: task.id, date: segment.date})
                    : 0;

                  return (
                    <div
                      key={`${task.id}-${segment.date}-${segment.topMinutes}-${segment.endMinutes}`}
                      draggable
                      aria-label={taskSegmentAriaLabel({task, segment, focusMinutes: taskFocusMinutes})}
                      onDragStart={(event) => {
                        const durationMinutes = taskDurationMinutes(task);
                        if (!durationMinutes) return;
                        writeCalendarDragPayload(event.dataTransfer, {
                          type: 'calendar-timed-task',
                          taskId: task.id,
                          durationMinutes,
                        });
                      }}
                      className="group pointer-events-auto absolute z-10 min-w-0 overflow-hidden rounded-md px-1.5 py-1 text-[11px] font-semibold leading-tight text-white shadow-sm"
                      style={{
                        backgroundColor: categoryColor(categories, task.categoryId),
                        ...timelineColumnBlockStyle(segment),
                        ...timelineLaneStyle(segment),
                      }}
                    >
                      <span className="sr-only">{taskSegmentLabel(task, segment)}</span>
                      <div className="truncate">{task.title}</div>
                      <div className="truncate text-[10px] font-medium text-white/80">{taskSegmentTimeLabel(segment)}</div>
                      {taskFocusMinutes > 0 && (
                        <div className="mt-1 truncate rounded bg-white/25 px-1 text-[10px]">
                          专注 {taskFocusMinutes}m
                        </div>
                      )}
                      {segment.isLastSegment && canResizeTimedTask(task.startAt) && (
                        <button
                          type="button"
                          aria-label={`调整${task.title}时长`}
                          className="pointer-events-none absolute inset-x-1 bottom-1 block h-1.5 rounded bg-white/45 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            const durationMinutes = taskDurationMinutes(task);
                            if (!task.startAt || !durationMinutes) {
                              return;
                            }
                            setResizeState({
                              taskId: task.id,
                              plannedDate: task.plannedDate,
                              startAt: task.startAt,
                              initialDurationMinutes: durationMinutes,
                              startY: event.clientY,
                            });
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
