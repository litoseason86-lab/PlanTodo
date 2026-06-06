import type {Category, Task} from '../../../../shared/domain/entities';
import {buildWeekDays} from '../controllers/calendarLayout';

const HOURS = Array.from({length: 18}, (_, index) => index + 6);

interface WeekTimelineViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

export function WeekTimelineView({anchorDate, tasksByDate, categories}: WeekTimelineViewProps) {
  const days = buildWeekDays(anchorDate);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200">
        <div className="p-2 text-xs font-bold text-slate-400">全天</div>
        {days.map((day) => (
          <div key={day.isoDate} className="min-h-20 border-l border-slate-100 p-2">
            <div className="mb-2 text-xs font-bold text-slate-500">{day.isoDate.slice(5)}</div>
            {(tasksByDate[day.isoDate] ?? []).filter((task) => task.allDay).map((task) => (
              <div key={task.id} className="mb-1 truncate rounded px-2 py-1 text-[11px] font-bold text-white" style={{backgroundColor: categoryColor(categories, task.categoryId)}}>
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
            <div key={`${day.isoDate}-${hour}`} className="min-h-12 border-l border-slate-100 p-1">
              {(tasksByDate[day.isoDate] ?? [])
                .filter((task) => !task.allDay && task.startAt?.slice(11, 13) === String(hour).padStart(2, '0'))
                .map((task) => (
                  <div key={task.id} className="truncate rounded px-2 py-1 text-[11px] font-bold text-white" style={{backgroundColor: categoryColor(categories, task.categoryId)}}>
                    {task.startAt?.slice(11, 16)} {task.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
