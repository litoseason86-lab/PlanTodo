import {GripVertical} from 'lucide-react';
import {useState} from 'react';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import type {useSchedulingSidebarController} from '../controllers/useSchedulingSidebarController';
import {writeCalendarDragPayload} from '../controllers/schedulingDrag';
import {uniqueSelectedTaskIds} from '../controllers/schedulingSidebarGrouping';

interface SchedulingSidebarProps {
  controller: ReturnType<typeof useSchedulingSidebarController>;
  categories: Category[];
  tags: Tag[];
}

export function SchedulingSidebar({controller, categories, tags}: SchedulingSidebarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasSelection = controller.selectedTaskIds.size > 0;
  const selectedTagNames = controller.tagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
    .filter((name): name is string => Boolean(name));

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

        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-xs font-bold text-slate-600"
        >
          筛选
        </button>

        {filtersOpen && (
          <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
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

            <fieldset aria-label="安排栏标签" className="space-y-2">
              <legend className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">安排栏标签</legend>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400">选择标签</span>
                <button
                  type="button"
                  onClick={() => controller.setTagIds([])}
                  disabled={controller.tagIds.length === 0}
                  className="text-[10px] font-bold text-slate-500 disabled:text-slate-300"
                >
                  清空标签
                </button>
              </div>
              <div
                className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
              >
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={controller.tagIds.includes(tag.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          controller.setTagIds([...controller.tagIds, tag.id]);
                        } else {
                          controller.setTagIds(controller.tagIds.filter((tagId) => tagId !== tag.id));
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
                {tags.length === 0 && <div className="text-xs font-semibold text-slate-400">暂无标签</div>}
              </div>
              {selectedTagNames.length > 0 && (
                <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] font-bold text-slate-500">
                  {selectedTagNames.slice(0, 2).map((name) => (
                    <span key={name} className="rounded-full bg-white px-2 py-0.5">{name}</span>
                  ))}
                  {selectedTagNames.length > 2 && <span>+{selectedTagNames.length - 2}</span>}
                </div>
              )}
            </fieldset>

            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">安排栏优先级</span>
              <select
                aria-label="安排栏优先级"
                value={controller.priority}
                onChange={(event) => controller.setPriority(event.target.value as typeof controller.priority)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="all">全部</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
                <option value="none">无优先级</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">安排栏分组</span>
              <select
                aria-label="安排栏分组"
                value={controller.groupMode}
                onChange={(event) => controller.setGroupMode(event.target.value as typeof controller.groupMode)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold outline-none"
              >
                <option value="none">不分组</option>
                <option value="category">按分类</option>
                <option value="tag">按标签</option>
                <option value="priority">按优先级</option>
              </select>
            </label>
          </div>
        )}
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
        {!controller.loading && controller.tasks.length > 0 && controller.groupedTaskGroups.map((group) => (
          <div key={group.id} className="divide-y divide-slate-100">
            <div className="flex items-center justify-between bg-slate-50/70 px-3 py-2 text-[10px] font-extrabold text-slate-500">
              <span>{group.label}</span>
              <span>{group.tasks.length}</span>
            </div>
            {group.tasks.map((task) => (
              <SchedulingTaskRow
                key={`${group.id}:${task.id}`}
                task={task}
                groupLabel={controller.groupMode === 'none' ? undefined : group.label}
                categories={categories}
                selected={controller.selectedTaskIds.has(task.id)}
                selectedTaskIds={controller.selectedTaskIds}
                onToggle={() => controller.toggleTask(task.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

interface SchedulingTaskRowProps {
  task: Task;
  groupLabel?: string;
  categories: Category[];
  selected: boolean;
  selectedTaskIds: Set<number>;
  onToggle: () => void;
}

function SchedulingTaskRow({task, groupLabel, categories, selected, selectedTaskIds, onToggle}: SchedulingTaskRowProps) {
  const category = categories.find((item) => item.id === task.categoryId);
  const rowLabel = groupLabel ? `${groupLabel} ${task.title}` : task.title;

  return (
    <div className="flex items-start gap-2 p-3">
      <input
        aria-label={`选择 ${rowLabel}`}
        type="checkbox"
        checked={selected}
        onChange={onToggle}
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
        aria-label={`拖拽 ${rowLabel}`}
        draggable
        onDragStart={(event) => {
          const selectedIds = uniqueSelectedTaskIds(selectedTaskIds);
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
}
