import {useEffect, useState} from 'react';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import type {TaskPriority} from '../../../../shared/domain/status';
import {TASK_PRIORITIES} from '../../../../shared/domain/status';
import {TagCombobox} from '../../tags/components/TagCombobox';

interface TaskBasicInfoModalProps {
  task: Task;
  categories: Category[];
  tags: Tag[];
  onCreateTag: (name: string) => Promise<Tag>;
  onSave: (details: {
    title: string;
    categoryId: number;
    tagIds: number[];
    priority: TaskPriority | null;
  }) => Promise<void> | void;
  onClose: () => void;
}

export function TaskBasicInfoModal({
  task,
  categories,
  tags,
  onCreateTag,
  onSave,
  onClose,
}: TaskBasicInfoModalProps) {
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [tagIds, setTagIds] = useState<number[]>(task.tagIds);
  const [priority, setPriority] = useState<TaskPriority | null>(task.priority);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setCategoryId(task.categoryId);
    setTagIds(task.tagIds);
    setPriority(task.priority);
  }, [task]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || !categoryId) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        title: nextTitle,
        categoryId,
        tagIds,
        priority,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold text-slate-800">编辑任务</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            关闭
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-details-title" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              任务标题
            </label>
            <input
              id="task-details-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-details-category" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              归属分类
            </label>
            <select
              id="task-details-category"
              value={categoryId}
              onChange={(event) => setCategoryId(Number(event.target.value))}
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-details-priority" className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              优先级
            </label>
            <select
              id="task-details-priority"
              value={priority ?? 'none'}
              onChange={(event) => setPriority(event.target.value === 'none' ? null : event.target.value as TaskPriority)}
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs font-semibold outline-none"
            >
              <option value="none">无</option>
              {TASK_PRIORITIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <TagCombobox
            tags={tags}
            selectedTagIds={tagIds}
            onChange={setTagIds}
            onCreateTag={onCreateTag}
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
