import {useEffect, useLayoutEffect, useRef, useState} from 'react';

import type {Category, Task} from '../../../../shared/domain/entities';
import {validateTimedRangeWithinBounds} from '../controllers/weekTimelineInteraction';

interface CalendarTaskPopoverProps {
  task: Task;
  categories: Category[];
  anchor: {x: number; y: number};
  onCancel: () => void;
  onSave: (input: {
    title: string;
    categoryId: number;
    startAt: string;
    endAt: string;
  }) => Promise<{ok: true} | {ok: false; message: string}>;
  onDelete: () => Promise<{ok: true} | {ok: false; message: string}>;
}

const POPOVER_MARGIN_PX = 12;
const POPOVER_FALLBACK_WIDTH_PX = 288;
const POPOVER_FALLBACK_HEIGHT_PX = 260;

function clampPopoverPosition(input: {
  anchor: {x: number; y: number};
  width: number;
  height: number;
}): {x: number; y: number} {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return input.anchor;
  }

  const maxX = Math.max(POPOVER_MARGIN_PX, viewportWidth - input.width - POPOVER_MARGIN_PX);
  const maxY = Math.max(POPOVER_MARGIN_PX, viewportHeight - input.height - POPOVER_MARGIN_PX);

  return {
    x: Math.min(Math.max(POPOVER_MARGIN_PX, input.anchor.x), maxX),
    y: Math.min(Math.max(POPOVER_MARGIN_PX, input.anchor.y), maxY),
  };
}

function timeValue(value: string | undefined): string {
  return value ? value.slice(11, 16) : '';
}

function plannedDateForTask(task: Task): string {
  return task.plannedDate ?? task.startAt?.slice(0, 10) ?? '';
}

function makeLocalDateTime(date: string, time: string): string {
  return `${date}T${time}:00.000`;
}

export function CalendarTaskPopover({
  task,
  categories,
  anchor,
  onCancel,
  onSave,
  onDelete,
}: CalendarTaskPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const plannedDate = plannedDateForTask(task);
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(task.categoryId);
  const [startTime, setStartTime] = useState(() => timeValue(task.startAt));
  const [endTime, setEndTime] = useState(() => timeValue(task.endAt));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [position, setPosition] = useState(() => clampPopoverPosition({
    anchor,
    width: POPOVER_FALLBACK_WIDTH_PX,
    height: POPOVER_FALLBACK_HEIGHT_PX,
  }));

  useLayoutEffect(() => {
    setPosition(clampPopoverPosition({
      anchor,
      width: POPOVER_FALLBACK_WIDTH_PX,
      height: POPOVER_FALLBACK_HEIGHT_PX,
    }));
  }, [anchor]);

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

  function clearTransientState() {
    setError('');
    setConfirmingDelete(false);
  }

  async function submitSave() {
    if (submittingRef.current) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('请输入任务标题');
      return;
    }

    const startAt = makeLocalDateTime(plannedDate, startTime);
    const endAt = makeLocalDateTime(plannedDate, endTime);
    const validation = validateTimedRangeWithinBounds({
      startAt,
      endAt,
      editableStartAt: `${plannedDate}T00:00:00.000`,
      editableEndAt: `${plannedDate}T23:59:00.000`,
    });

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await onSave({title: trimmedTitle, categoryId, startAt, endAt});
      if (!result.ok) {
        setError(result.message);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '任务保存失败');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function submitDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setError('');
      return;
    }

    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const result = await onDelete();
      if (!result.ok) {
        setError(result.message);
        setConfirmingDelete(false);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '任务删除失败');
      setConfirmingDelete(false);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="编辑日历任务"
      tabIndex={-1}
      className="z-50 w-72 rounded-lg border border-slate-200 bg-white p-4 text-xs shadow-lg"
      style={{position: 'fixed', left: position.x, top: position.y}}
    >
      <div className="mb-3 font-bold text-slate-700">编辑任务</div>
      <div className="grid gap-3">
        <input
          aria-label="任务标题"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            clearTransientState();
          }}
        />
        <select
          aria-label="任务分类"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
          value={categoryId}
          disabled={categories.length === 0}
          onChange={(event) => {
            setCategoryId(Number(event.target.value));
            clearTransientState();
          }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="开始时间"
            type="time"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            value={startTime}
            onChange={(event) => {
              setStartTime(event.target.value);
              clearTransientState();
            }}
          />
          <input
            aria-label="结束时间"
            type="time"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            value={endTime}
            onChange={(event) => {
              setEndTime(event.target.value);
              clearTransientState();
            }}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="mt-4 flex justify-between gap-2">
        <button
          type="button"
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
          disabled={isSubmitting}
          onClick={() => void submitDelete()}
        >
          {confirmingDelete ? '确认删除' : '删除'}
        </button>
        <div className="flex justify-end gap-2">
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
            onClick={() => void submitSave()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
