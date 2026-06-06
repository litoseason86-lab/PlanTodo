import type {Category, Task} from '../../../../shared/domain/entities';
import {buildMonthGrid, segmentAllDayTask} from '../controllers/calendarLayout';

interface MonthCalendarViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
  onCreateDateTask: (date: string) => Promise<void>;
  onScheduleDate: (taskId: number, date: string) => Promise<void>;
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

function readDragPayload(event: React.DragEvent): {taskId: number} | undefined {
  const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
  if (!raw) {
    return undefined;
  }

  try {
    const payload = raw.startsWith('{') ? JSON.parse(raw) as {taskId?: unknown} : {taskId: Number(raw)};
    return typeof payload.taskId === 'number' && Number.isFinite(payload.taskId) ? {taskId: payload.taskId} : undefined;
  } catch {
    return undefined;
  }
}

export function MonthCalendarView({
  anchorDate,
  tasksByDate,
  categories,
  onCreateDateTask,
  onScheduleDate,
}: MonthCalendarViewProps) {
  const days = buildMonthGrid(anchorDate);
  const visibleStart = days[0].isoDate;
  const visibleEnd = days[days.length - 1].isoDate;

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {days.map((day) => (
        <button
          key={day.isoDate}
          type="button"
          aria-label={day.isoDate}
          onClick={() => void onCreateDateTask(day.isoDate)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const payload = readDragPayload(event);
            if (payload?.taskId) {
              void onScheduleDate(payload.taskId, day.isoDate);
            }
          }}
          className={`min-h-28 border-b border-r border-slate-100 p-2 text-left align-top ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'}`}
        >
          <span className="text-xs font-bold">{day.isoDate.slice(8)}</span>
          <span className="mt-2 block space-y-1">
            {(tasksByDate[day.isoDate] ?? [])
              .filter((task): task is Task & {plannedDate: string} => Boolean(task.plannedDate))
              .slice(0, 4)
              .map((task) => {
              const segment = task.allDay ? segmentAllDayTask(task, visibleStart, visibleEnd) : undefined;
              const startsHere = !segment || segment.startsOn === day.isoDate;
              const endsHere = !segment || segment.endsOn === day.isoDate;

              return (
                <span
                  key={task.id}
                  onClick={(event) => event.stopPropagation()}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.setData('application/json', JSON.stringify({taskId: task.id}));
                    event.dataTransfer.setData('text/plain', String(task.id));
                  }}
                  className={`block truncate px-2 py-1 text-[11px] font-bold text-white ${startsHere ? 'rounded-l' : 'rounded-l-none'} ${endsHere ? 'rounded-r' : 'rounded-r-none'}`}
                  style={{backgroundColor: categoryColor(categories, task.categoryId)}}
                  title={task.title}
                >
                  {!startsHere ? '↤ ' : ''}
                  {task.title}
                  {!endsHere ? ' ↦' : ''}
                </span>
              );
            })}
          </span>
        </button>
      ))}
    </div>
  );
}
