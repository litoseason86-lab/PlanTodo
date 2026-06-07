import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';

interface TodayFocusFeedbackProps {
  task: Task;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  setLastFinishedSessionTask: (task: Task | null) => void;
}

export function TodayFocusFeedback({
  task,
  handleUpdateTaskStatus,
  setLastFinishedSessionTask,
}: TodayFocusFeedbackProps) {
  return (
    <div className="bg-white border-2 border-dashed border-rose-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95" id="feedback_panel">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-rose-50 flex items-center justify-center text-lg shadow-sm">💡</div>
        <div className="min-w-0">
          <h4 className="font-bold text-sm text-slate-800">完成了刚才的心流阶段？</h4>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            主线聚焦: <strong className="text-rose-600">「{task.title}」</strong>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            handleUpdateTaskStatus(task.id, 'DONE');
            setLastFinishedSessionTask(null);
          }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-emerald-200/40 transition-all hover:scale-[1.02]"
        >
          ✓ 完美标记
        </button>
        <button
          type="button"
          onClick={() => setLastFinishedSessionTask(null)}
          className="text-slate-400 hover:bg-slate-100 text-xs font-semibold px-4 py-2 rounded-xl transition"
        >
          稍后处理
        </button>
      </div>
    </div>
  );
}
