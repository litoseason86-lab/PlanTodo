import type {Category, Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';

interface TodayTimelineTaskNodeProps {
  task: Task;
  category: Category | undefined;
  focusMinutes: number;
  isActiveTask: boolean;
  primaryColor: string;
  timeLabel?: string;
  handleStartSession: (task: Task) => void;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
}

export function TodayTimelineTaskNode({
  task,
  category,
  focusMinutes,
  isActiveTask,
  primaryColor,
  timeLabel,
  handleStartSession,
  handleUpdateTaskStatus,
}: TodayTimelineTaskNodeProps) {
  let nodeDotClass = 'bg-white border-2 border-slate-300';
  let nodeInnerDotColor = 'transparent';

  if (isActiveTask) {
    nodeDotClass = 'bg-white shadow-md ring-4 ring-[var(--color-primary)]/15';
    nodeInnerDotColor = primaryColor;
  } else if (task.status === 'DONE') {
    nodeDotClass = 'bg-emerald-100 border-2 border-emerald-400';
    nodeInnerDotColor = '#34d399';
  } else if (task.status === 'NOT_DONE') {
    nodeDotClass = 'bg-rose-50 border-2 border-rose-300';
    nodeInnerDotColor = '#fca5a5';
  }

  return (
    <div className="relative group/card fade-in-up flex items-start gap-3">
      {timeLabel && (
        <div className="w-[72px] shrink-0 pt-5 text-right text-[11px] font-semibold text-slate-400">
          {timeLabel}
        </div>
      )}

      <div className="relative shrink-0 pt-5">
        <div
          className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${nodeDotClass}`}
          style={isActiveTask ? {borderColor: primaryColor} : undefined}
        >
          <div className="w-1.5 h-1.5 rounded-full transition-colors" style={{backgroundColor: nodeInnerDotColor}} />
        </div>
      </div>

      <div
        className={`min-w-0 flex-1 bg-white border-2 p-5 rounded-xl transition-all duration-200 select-none ${
          isActiveTask
            ? 'border-[var(--color-primary)] shadow-md bg-[var(--color-light)]'
            : task.status === 'DONE'
              ? 'border-slate-200/60 bg-slate-50/30'
              : 'border-slate-200/60 hover:border-[var(--color-primary)]/40 hover:shadow-sm hover:bg-[var(--color-light)]'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <h4 className={`truncate text-sm tracking-tight font-bold leading-snug ${task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {task.title}
            </h4>

            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full border"
                style={{
                  color: category ? category.color : '#64748b',
                  backgroundColor: `${category ? category.color : '#94a3b8'}10`,
                  borderColor: `${category ? category.color : '#94a3b8'}20`,
                }}
              >
                {category ? category.name : '未分类'}
              </span>

              {focusMinutes > 0 && (
                <span className="text-[10px] font-semibold text-indigo-500 font-mono bg-indigo-50 px-2 py-0.5 rounded-full">
                  ⏱ {focusMinutes} 分钟
                </span>
              )}

              {task.status === 'NOT_DONE' && (
                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">已搁置</span>
              )}

              {isActiveTask && (
                <span className="text-[10px] font-bold bg-[var(--color-light)] px-2 py-0.5 rounded-full animate-pulse" style={{color: primaryColor}}>
                  专注进行中
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover/card:opacity-100 transition-all duration-200 shrink-0">
            {!isActiveTask && task.status !== 'DONE' && (
              <button
                type="button"
                onClick={() => handleStartSession(task)}
                className="px-2.5 py-1.5 bg-[var(--color-primary)]/10 rounded-lg hover:bg-[var(--color-primary)]/20 transition-all text-[10px] font-bold cursor-pointer"
                style={{color: primaryColor}}
                title="开启心流专注"
              >
                ▶ 专注
              </button>
            )}

            {task.status !== 'DONE' && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold cursor-pointer"
                title="标记完成"
              >
                ✓ 完成
              </button>
            )}

            {task.status !== 'NOT_DONE' && task.status !== 'DONE' && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'NOT_DONE')}
                className="px-2.5 py-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition text-[10px] font-bold cursor-pointer"
                title="搁置"
              >
                ✗ 搁置
              </button>
            )}

            {(task.status === 'DONE' || task.status === 'NOT_DONE') && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'TODO')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold rounded-lg transition"
              >
                重置
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
