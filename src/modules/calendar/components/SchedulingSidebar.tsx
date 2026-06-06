import {GripVertical} from 'lucide-react';

import type {Category} from '../../../../shared/domain/entities';
import type {useSchedulingSidebarController} from '../controllers/useSchedulingSidebarController';
import {writeCalendarDragPayload} from '../controllers/schedulingDrag';

interface SchedulingSidebarProps {
  controller: ReturnType<typeof useSchedulingSidebarController>;
  categories: Category[];
}

export function SchedulingSidebar({controller, categories}: SchedulingSidebarProps) {
  const hasSelection = controller.selectedTaskIds.size > 0;

  return (
    <aside className="bg-white border border-slate-200/60 rounded-2xl p-4 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-extrabold text-slate-700">安排任务</h3>
        <span className="text-[10px] font-semibold text-slate-400">{controller.tasks.length} 项</span>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">搜索安排任务</span>
          <input
            aria-label="搜索安排任务"
            value={controller.query}
            onChange={(event) => controller.setQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2 text-xs font-semibold outline-none focus:bg-white"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">安排栏分类</span>
          <select
            aria-label="安排栏分类"
            value={controller.categoryId}
            onChange={(event) => controller.setCategoryId(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none"
          >
            <option value="all">全部</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={controller.selectAllVisible} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">
          全选
        </button>
        <button type="button" onClick={controller.clearSelected} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">
          清空
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">批量安排日期</span>
        <input
          aria-label="批量安排日期"
          type="date"
          value={controller.selectedScheduleDate}
          onChange={(event) => controller.setSelectedScheduleDate(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!hasSelection || !controller.selectedScheduleDate}
          onClick={() => void controller.batchScheduleSelected(controller.selectedScheduleDate)}
          className="rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          安排所选
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => void controller.batchUnscheduleSelected()}
          className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          取消安排
        </button>
      </div>

      <div className="max-h-[520px] overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
        {controller.loading && (
          <div className="p-4 text-xs font-semibold text-slate-400">加载中</div>
        )}
        {!controller.loading && controller.tasks.length === 0 && (
          <div className="p-4 text-xs font-semibold text-slate-400">暂无可安排任务</div>
        )}
        {!controller.loading && controller.tasks.map((task) => {
          const category = categories.find((item) => item.id === task.categoryId);
          const selected = controller.selectedTaskIds.has(task.id);
          return (
            <div key={task.id} className="flex items-start gap-2 p-3">
              <input
                aria-label={`选择 ${task.title}`}
                type="checkbox"
                checked={selected}
                onChange={() => controller.toggleTask(task.id)}
                className="mt-1 h-3.5 w-3.5 rounded border-slate-300"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-xs font-bold text-slate-700">{task.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
                    style={{
                      color: category?.color ?? '#64748b',
                      borderColor: `${category?.color ?? '#94a3b8'}33`,
                      backgroundColor: `${category?.color ?? '#94a3b8'}10`,
                    }}
                  >
                    {category?.name ?? '通用'}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">{task.plannedDate ?? '未安排'}</span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`拖拽 ${task.title}`}
                draggable
                onDragStart={(event) => {
                  const selectedIds = [...controller.selectedTaskIds];
                  if (selected && selectedIds.length > 1) {
                    writeCalendarDragPayload(event.dataTransfer, {type: 'calendar-task-batch', taskIds: selectedIds, source: 'sidebar'});
                    return;
                  }
                  writeCalendarDragPayload(event.dataTransfer, {type: 'calendar-task', taskId: task.id, source: 'sidebar'});
                }}
                className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-500"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
