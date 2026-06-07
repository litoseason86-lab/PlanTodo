import {Calendar, Edit3, GripVertical, Trash2} from 'lucide-react';

import type {Category, Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {writeCalendarDragPayload} from '../../calendar/controllers/schedulingDrag';
import {timedTaskDurationMinutes} from '../../calendar/controllers/weekTimelineLayout';

interface TaskListItemProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  task: Task;
  category?: Category;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  handleStartSession: (task: Task) => void;
  handleDeleteTask: (taskId: number) => void;
  onEditTask: (task: Task) => void;
}

function writeTaskListDragPayload(dataTransfer: DataTransfer, task: Task): void {
  if (!task.allDay && task.startAt && task.endAt) {
    writeCalendarDragPayload(dataTransfer, {
      type: 'calendar-timed-task',
      taskId: task.id,
      durationMinutes: timedTaskDurationMinutes({startAt: task.startAt, endAt: task.endAt}),
    });
    return;
  }

  writeCalendarDragPayload(dataTransfer, {type: 'calendar-task', taskId: task.id, source: 'task-list'});
}

export function TaskListItem({
  styleContext,
  task,
  category,
  handleUpdateTaskStatus,
  handleStartSession,
  handleDeleteTask,
  onEditTask,
}: TaskListItemProps) {
  const isComplete = task.status === 'DONE';

  return (
    <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all group/task">
      <div className="space-y-1.5 pr-4">
        <h4 className={`text-xs font-bold leading-normal ${isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
          {task.title}
        </h4>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider"
            style={{
              color: category ? category.color : '#64748b',
              backgroundColor: `${category ? category.color : '#94a3b8'}10`,
              borderColor: `${category ? category.color : '#94a3b8'}20`,
            }}
          >
            {category ? category.name : '通用'}
          </span>
          <span className="text-[9px] text-slate-400 font-mono font-semibold flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-300" />
            {task.plannedDate ?? '未安排'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 select-none">
        <button
          type="button"
          aria-label={`拖拽任务 ${task.title}`}
          draggable
          onDragStart={(event) => {
            writeTaskListDragPayload(event.dataTransfer, task);
          }}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <select
          aria-label={`task-status-${task.id}`}
          value={task.status}
          onChange={(event) => {
            const nextStatus = event.target.value as TaskStatus;
            if (nextStatus === 'IN_PROGRESS') {
              handleStartSession(task);
              return;
            }
            handleUpdateTaskStatus(task.id, nextStatus);
          }}
          className="px-2 py-1 text-[10px] border border-slate-200 bg-white rounded-lg text-slate-600 font-semibold outline-none transition-colors hover:border-slate-300"
        >
          <option value="TODO">待执行</option>
          <option value="IN_PROGRESS">专注中</option>
          <option value="DONE">已完结</option>
          <option value="NOT_DONE">未完成</option>
        </select>

        {!isComplete && (
          <button
            type="button"
            onClick={() => handleStartSession(task)}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all"
            style={{color: styleContext.primary, backgroundColor: styleContext.primaryLight}}
            onMouseOver={(event) => { event.currentTarget.style.backgroundColor = `${styleContext.secondary}40`; }}
            onMouseOut={(event) => { event.currentTarget.style.backgroundColor = styleContext.primaryLight; }}
          >
            ▶ 专注
          </button>
        )}

        <button
          type="button"
          aria-label={`编辑任务 ${task.title}`}
          title="编辑任务"
          onClick={() => onEditTask(task)}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          aria-label={`删除任务 ${task.title}`}
          title="删除任务"
          onClick={() => handleDeleteTask(task.id)}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
