import type {Task} from '../../../../shared/domain/entities';

interface TodayCurrentActionProps {
  task: Task;
  focusMinutes: number;
  primaryColor: string;
  onStopSession: () => void;
}

export function TodayCurrentAction({task, focusMinutes, primaryColor, onStopSession}: TodayCurrentActionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="当前行动">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400">当前行动</p>
          <h3 className="truncate text-sm font-extrabold text-slate-800">{task.title}</h3>
          <p className="text-[11px] font-semibold text-slate-500">专注进行中 · {focusMinutes} 分钟</p>
        </div>
        <button
          type="button"
          onClick={onStopSession}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
          style={{boxShadow: `0 0 0 1px ${primaryColor}22`}}
        >
          停止
        </button>
      </div>
    </section>
  );
}
