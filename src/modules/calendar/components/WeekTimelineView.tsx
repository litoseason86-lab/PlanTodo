import {useEffect, useState} from 'react';

import type {Category, Task} from '../../../../shared/domain/entities';
import {buildWeekDays} from '../controllers/calendarLayout';
import {
  TIMELINE_END_HOUR,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_HOUR,
  buildTimedTaskBlock,
} from '../controllers/weekTimelineLayout';

const HOURS = Array.from({length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1}, (_, index) => index + TIMELINE_START_HOUR);

interface WeekTimelineViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
  onScheduleTime: (input: {taskId: number; date: string; hour: number; minute: number}) => Promise<void>;
  onMoveTimedTask: (input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}) => Promise<void>;
  onResizeTimedTask: (input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}) => Promise<void>;
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

function readDragPayload(event: React.DragEvent): {taskId: number; durationMinutes?: number} | undefined {
  const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
  if (!raw) {
    return undefined;
  }

  try {
    const payload = raw.startsWith('{')
      ? JSON.parse(raw) as {taskId?: unknown; durationMinutes?: unknown}
      : {taskId: Number(raw)};
    if (typeof payload.taskId !== 'number' || !Number.isFinite(payload.taskId)) {
      return undefined;
    }
    return typeof payload.durationMinutes === 'number' && Number.isFinite(payload.durationMinutes)
      ? {taskId: payload.taskId, durationMinutes: payload.durationMinutes}
      : {taskId: payload.taskId};
  } catch {
    return undefined;
  }
}

function writeDragPayload(event: React.DragEvent, payload: {taskId: number; durationMinutes?: number}) {
  event.dataTransfer.setData('application/json', JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', String(payload.taskId));
}

function taskDurationMinutes(task: Task): number | undefined {
  if (!task.startAt || !task.endAt) {
    return undefined;
  }
  return buildTimedTaskBlock({startAt: task.startAt, endAt: task.endAt}).durationMinutes;
}

function getResizeDurationMinutes(input: {
  initialDurationMinutes: number;
  startY: number;
  currentY: number;
}): number {
  const deltaMinutes = Math.round((input.currentY - input.startY) / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES;
  return Math.max(TIMELINE_SLOT_MINUTES, input.initialDurationMinutes + deltaMinutes);
}

export function WeekTimelineView({
  anchorDate,
  tasksByDate,
  categories,
  onScheduleTime,
  onMoveTimedTask,
  onResizeTimedTask,
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
          <div key={day.isoDate} className="min-h-20 border-l border-slate-100 p-2">
            <div className="mb-2 text-xs font-bold text-slate-500">{day.isoDate.slice(5)}</div>
            {(tasksByDate[day.isoDate] ?? []).filter((task) => task.allDay).map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(event) => writeDragPayload(event, {taskId: task.id})}
                className="mb-1 truncate rounded px-2 py-1 text-[11px] font-bold text-white"
                style={{backgroundColor: categoryColor(categories, task.categoryId)}}
              >
                {task.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      {HOURS.map((hour) => (
        <div key={hour} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-100">
          <div className="p-2 text-xs font-semibold text-slate-400">{String(hour).padStart(2, '0')}:00</div>
          {days.map((day) => (
            <div
              key={`${day.isoDate}-${hour}`}
              aria-label={`${day.isoDate} ${String(hour).padStart(2, '0')}:00`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const payload = readDragPayload(event);
                if (!payload?.taskId) {
                  return;
                }
                if (payload.durationMinutes) {
                  void onMoveTimedTask({
                    taskId: payload.taskId,
                    date: day.isoDate,
                    hour,
                    minute: 0,
                    durationMinutes: payload.durationMinutes,
                  });
                  return;
                }
                void onScheduleTime({taskId: payload.taskId, date: day.isoDate, hour, minute: 0});
              }}
              className="min-h-12 border-l border-slate-100 p-1"
            >
              {(tasksByDate[day.isoDate] ?? [])
                .filter((task) => !task.allDay && task.startAt?.slice(11, 13) === String(hour).padStart(2, '0'))
                .map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(event) => writeDragPayload(event, {
                      taskId: task.id,
                      durationMinutes: taskDurationMinutes(task),
                    })}
                    className="truncate rounded px-2 py-1 text-[11px] font-bold text-white"
                    style={{backgroundColor: categoryColor(categories, task.categoryId)}}
                  >
                    {task.startAt?.slice(11, 16)} {task.title}
                    <button
                      type="button"
                      aria-label={`调整${task.title}时长`}
                      className="mt-1 block h-2 w-full rounded bg-white/40"
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
                  </div>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
