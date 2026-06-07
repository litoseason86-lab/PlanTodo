import type {Category, Tag} from '../../../../shared/domain/entities';
import type {TaskPriority, TaskStatus} from '../../../../shared/domain/status';
import {TASK_PRIORITIES} from '../../../../shared/domain/status';

type TaskFilterDateScope = 'today' | 'seven-days' | 'all' | 'unscheduled';
type TaskPriorityFilter = 'all' | 'none' | TaskPriority;

interface TaskFilterBarProps {
  categories: Category[];
  tags: Tag[];
  filteredCount: number;
  calendarVisible: boolean;
  taskFilterCategory: string;
  taskFilterStatus: string;
  taskFilterDateScope: TaskFilterDateScope;
  selectedTagIds: number[];
  priority: TaskPriorityFilter;
  query: string;
  setTaskFilterCategory: (value: string) => void;
  setTaskFilterStatus: (value: 'all' | TaskStatus) => void;
  setTaskFilterDateScope: (value: TaskFilterDateScope) => void;
  onTagIdsChange: (value: number[]) => void;
  onPriorityChange: (value: TaskPriorityFilter) => void;
  onQueryChange: (value: string) => void;
  onToggleCalendar: () => void;
}

export function TaskFilterBar({
  categories,
  tags,
  filteredCount,
  calendarVisible,
  taskFilterCategory,
  taskFilterStatus,
  taskFilterDateScope,
  selectedTagIds,
  priority,
  query,
  setTaskFilterCategory,
  setTaskFilterStatus,
  setTaskFilterDateScope,
  onTagIdsChange,
  onPriorityChange,
  onQueryChange,
  onToggleCalendar,
}: TaskFilterBarProps) {
  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onTagIdsChange(selectedTagIds.filter((selectedId) => selectedId !== tagId));
      return;
    }
    onTagIdsChange([...selectedTagIds, tagId]);
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/40 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">搜索</p>
          <input
            type="search"
            aria-label="搜索任务"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="w-36 px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
          />
        </div>

        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">分类</p>
          <select
            value={taskFilterCategory}
            onChange={(event) => setTaskFilterCategory(event.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
          >
            <option value="all">全部</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">状态</p>
          <select
            value={taskFilterStatus}
            onChange={(event) => setTaskFilterStatus(event.target.value as 'all' | TaskStatus)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
          >
            <option value="all">全部</option>
            <option value="TODO">待执行</option>
            <option value="IN_PROGRESS">进行中</option>
            <option value="DONE">已完结</option>
            <option value="NOT_DONE">已搁置</option>
          </select>
        </div>

        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">日期</p>
          <select
            value={taskFilterDateScope}
            onChange={(event) => setTaskFilterDateScope(event.target.value as TaskFilterDateScope)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
          >
            <option value="today">今日</option>
            <option value="seven-days">未来7天</option>
            <option value="unscheduled">未安排</option>
            <option value="all">全部</option>
          </select>
        </div>

        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">优先级</p>
          <select
            value={priority}
            onChange={(event) => onPriorityChange(event.target.value as TaskPriorityFilter)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg text-slate-700 font-semibold outline-none transition-colors hover:border-slate-300"
          >
            <option value="all">全部</option>
            <option value="none">无</option>
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest pl-1">标签</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
                >
                  <input
                    type="checkbox"
                    aria-label={`筛选标签 ${tag.name}`}
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="h-3 w-3 rounded border-slate-300"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-400 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60">
          匹配: {filteredCount} 项
        </span>
        <button
          type="button"
          onClick={onToggleCalendar}
          className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          {calendarVisible ? '隐藏日历' : '显示日历'}
        </button>
      </div>
    </div>
  );
}
