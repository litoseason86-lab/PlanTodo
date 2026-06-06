import type {Category, Task} from '../../../../shared/domain/entities';
import {enumerateDateRange} from '../../../../shared/lib/schedule';

interface CalendarListViewProps {
  dateFrom: string;
  dateTo: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

export function CalendarListView({dateFrom, dateTo, tasksByDate, categories}: CalendarListViewProps) {
  return (
    <div className="space-y-3">
      {enumerateDateRange(dateFrom, dateTo).map((date) => (
        <section key={date} className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold text-slate-500">{date}</h3>
          <div className="space-y-2">
            {(tasksByDate[date] ?? []).map((task) => (
              <div key={`${date}-${task.id}`} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: categoryColor(categories, task.categoryId)}} />
                <span className="text-xs font-bold text-slate-700">{task.title}</span>
                {!task.allDay && task.startAt && task.endAt && (
                  <span className="ml-auto text-[11px] font-semibold text-slate-400">{task.startAt.slice(11, 16)}-{task.endAt.slice(11, 16)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
