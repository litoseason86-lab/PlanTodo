import {useEffect, useRef, useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import type {CalendarQuickCreateDraft} from '../controllers/weekTimelineInteraction';

interface CalendarQuickCreatePopoverProps {
  draft: CalendarQuickCreateDraft;
  categories: Category[];
  onCancel: () => void;
  onSubmit: (input: {title: string; categoryId: number}) => Promise<{ok: true} | {ok: false; message: string}>;
}

function formatDraftRange(draft: CalendarQuickCreateDraft): string {
  if (draft.kind === 'timed') {
    return `${draft.startAt.slice(11, 16)} - ${draft.endAt.slice(11, 16)}`;
  }

  const endDate = draft.plannedEndDate ?? draft.plannedDate;
  return `${draft.plannedDate.slice(5, 10)} - ${endDate.slice(5, 10)}`;
}

export function CalendarQuickCreatePopover({draft, categories, onCancel, onSubmit}: CalendarQuickCreatePopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const submittingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? 0);
  const [error, setError] = useState(categories.length === 0 ? '请先创建分类' : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length === 0) {
      setCategoryId(0);
      setError('请先创建分类');
      return;
    }

    if (!categories.some((category) => category.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
    setError((currentError) => (currentError === '请先创建分类' ? '' : currentError));
  }, [categories, categoryId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const dialog = dialogRef.current;
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        onCancel();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onCancel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  async function submitForm() {
    if (submittingRef.current) return;

    if (categories.length === 0) {
      setError('请先创建分类');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('请输入任务标题');
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await onSubmit({title: trimmedTitle, categoryId});
      if (mountedRef.current && requestIdRef.current === requestId && !result.ok) {
        setError(result.message);
      }
    } catch (caughtError) {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setError(caughtError instanceof Error ? caughtError.message : '创建失败');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        submittingRef.current = false;
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="快速创建任务"
      tabIndex={-1}
      className="z-50 w-72 rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-lg"
      style={{position: 'fixed', left: draft.anchor.x, top: draft.anchor.y}}
    >
      <div className="mb-3 font-bold text-slate-700">{formatDraftRange(draft)}</div>
      <div className="grid gap-3">
        <input
          aria-label="任务标题"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error === '请输入任务标题') {
              setError('');
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submitForm();
            }
          }}
        />
        <select
          aria-label="任务分类"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          value={categoryId}
          disabled={categories.length === 0}
          onChange={(event) => setCategoryId(Number(event.target.value))}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={categories.length === 0 || isSubmitting}
          onClick={() => void submitForm()}
        >
          保存
        </button>
      </div>
    </div>
  );
}
