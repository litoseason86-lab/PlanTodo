import {useEffect, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {toIsoDate} from '../../../../shared/lib/date';
import {focusSessionDurationMinutes, isCountedFocusSession} from '../../../../shared/lib/focusSessions';
import {buildWeekDays} from '../controllers/calendarLayout';
import {
  TIMELINE_END_HOUR,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_HOUR,
  buildTimedTaskDayLayout,
  getTimelineDropClock,
  timedTaskDurationMinutes,
  type TimedTaskDayLayoutSegment,
} from '../controllers/weekTimelineLayout';
import {readCalendarDragPayload, writeCalendarDragPayload} from '../controllers/schedulingDrag';

const HOURS = Array.from({length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1}, (_, index) => index + TIMELINE_START_HOUR);
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const TIMELINE_LANE_GAP_PX = 4;

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
}

interface ResizeState {
  taskId: number;
  plannedDate: string;
  startAt: string;
  initialDurationMinutes: number;
  startY: number;
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

function getResizeDurationMinutes(input: {
  initialDurationMinutes: number;
  startY: number;
  currentY: number;
}): number {
  const deltaMinutes = Math.round((input.currentY - input.startY) / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES;
  return Math.max(TIMELINE_SLOT_MINUTES, input.initialDurationMinutes + deltaMinutes);
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
}: WeekTimelineViewProps) {
  const days = buildWeekDays(anchorDate);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  useEffect(() => {
    if (!resizeState) {
      return undefined;
    }

    const onPointerUp = (event: PointerEvent) => {
      const durationMinutes = getResizeDurationMinutes({
        initialDurationMinutes: resizeState.initialDurationMinutes,
        startY: resizeState.startY,
        currentY: event.clientY,
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
  }, [onResizeTimedTask, resizeState]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200">
        <div className="p-2 text-xs font-bold text-slate-400">全天</div>
        {days.map((day) => (
          <div
            key={day.isoDate}
            aria-label={`${day.isoDate} 全天`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const payload = readCalendarDragPayload(event.dataTransfer);
              if (!payload) return;
              if (payload.type === 'calendar-task-batch') {
                void onBatchScheduleDate(payload.taskIds, day.isoDate);
                return;
              }
              void onScheduleDate(payload.taskId, day.isoDate);
            }}
            className="min-h-20 border-l border-slate-100 p-2"
          >
            <div className="mb-2 text-xs font-bold text-slate-500">{day.isoDate.slice(5)}</div>
            {(tasksByDate[day.isoDate] ?? []).filter((task) => task.allDay && task.plannedDate).map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(event) => writeCalendarDragPayload(event.dataTransfer, {type: 'calendar-task', taskId: task.id, source: 'calendar'})}
                className="mb-1 truncate rounded px-2 py-1 text-[11px] font-bold text-white"
                style={{backgroundColor: categoryColor(categories, task.categoryId)}}
              >
                {task.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div>
          {HOURS.map((hour) => (
            <div key={hour} className="h-16 border-b border-slate-100 p-2 text-xs font-semibold text-slate-400">
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
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
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
                  className="h-16 border-b border-slate-100"
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
                      {segment.isLastSegment && (
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
