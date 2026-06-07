import type React from 'react';

import {Plus} from 'lucide-react';

import type {Category, Tag} from '../../../../shared/domain/entities';
import type {TaskPriority} from '../../../../shared/domain/status';
import {TASK_PRIORITIES} from '../../../../shared/domain/status';
import {TagCombobox} from '../../tags/components/TagCombobox';
import type {CreateTaskScheduleOverride} from '../controllers/useTaskActions';

interface TaskCreateFormProps {
  styleContext: {
    primary: string;
    primaryLight: string;
  };
  categories: Category[];
  taskFormTitle: string;
  taskFormCategory: number;
  taskFormDate: string;
  taskFormUnscheduled: boolean;
  selectedTagIds: number[];
  priority: TaskPriority | null;
  setTaskFormTitle: (value: string) => void;
  setTaskFormCategory: (value: number) => void;
  setTaskFormDate: (value: string) => void;
  setTaskFormUnscheduled: (value: boolean) => void;
  onTagIdsChange: (value: number[]) => void;
  onPriorityChange: (value: TaskPriority | null) => void;
  tags: Tag[];
  onCreateTag: (name: string) => Promise<Tag>;
  handleCreateTask: (event?: React.FormEvent, scheduleOverride?: CreateTaskScheduleOverride) => void;
}

export function TaskCreateForm({
  styleContext,
  categories,
  taskFormTitle,
  taskFormCategory,
  taskFormDate,
  taskFormUnscheduled,
  selectedTagIds,
  priority,
  setTaskFormTitle,
  setTaskFormCategory,
  setTaskFormDate,
  setTaskFormUnscheduled,
  onTagIdsChange,
  onPriorityChange,
  tags,
  onCreateTag,
  handleCreateTask,
}: TaskCreateFormProps) {
  return (
    <div className="bg-white border border-slate-200/60 p-6 rounded-2xl space-y-4 h-fit shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
        <Plus className="w-4 h-4" style={{color: styleContext.primary}} />
        新建储备规划项
      </h3>

      <form onSubmit={(event) => handleCreateTask(event)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">行动主题</label>
          <input
            type="text"
            placeholder="e.g. 审定核心业务数据"
            value={taskFormTitle}
            onChange={(event) => setTaskFormTitle(event.target.value)}
            className="w-full text-xs border border-slate-200 bg-slate-50/50 p-2.5 rounded-xl focus:bg-white outline-none focus:border-[var(--color-primary)] font-semibold transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">优先级</label>
          <select
            value={priority ?? 'none'}
            onChange={(event) => onPriorityChange(event.target.value === 'none' ? null : event.target.value as TaskPriority)}
            className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-50 font-semibold transition-colors"
          >
            <option value="none">无</option>
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <TagCombobox
          tags={tags}
          selectedTagIds={selectedTagIds}
          onChange={onTagIdsChange}
          onCreateTag={onCreateTag}
        />

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">归属分类</label>
          <select
            value={taskFormCategory}
            onChange={(event) => setTaskFormCategory(Number(event.target.value))}
            className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer hover:bg-slate-50 font-semibold transition-colors"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
            {categories.length === 0 && <option value="">暂无分类</option>}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">排期日期</label>
          <input
            type="date"
            value={taskFormDate}
            disabled={taskFormUnscheduled}
            onChange={(event) => setTaskFormDate(event.target.value)}
            className="w-full text-xs border border-slate-200 bg-white p-2.5 rounded-xl outline-none cursor-pointer font-semibold hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={taskFormUnscheduled}
            onChange={(event) => setTaskFormUnscheduled(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          不安排日期
        </label>

        <button
          type="submit"
          className="w-full text-white text-xs font-bold py-3 rounded-xl shadow-sm shadow-[var(--color-primary)]/20 flex items-center justify-center gap-1.5 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          style={{backgroundColor: styleContext.primary}}
        >
          <Plus className="w-3.5 h-3.5" /> 确认归档入库
        </button>
      </form>
    </div>
  );
}
