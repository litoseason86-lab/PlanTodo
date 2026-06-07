import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {TodayTimelineTaskNode} from './TodayTimelineTaskNode';

interface TodayTaskQueueProps {
  categories: Category[];
  tasks: Task[];
  runningSession: TaskExecutionSession | null;
  primaryColor: string;
  handleStartSession: (task: Task) => void;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  getTaskFocusMinutes: (taskId: number) => number;
}

export function TodayTaskQueue({
  categories,
  tasks,
  runningSession,
  primaryColor,
  handleStartSession,
  handleUpdateTaskStatus,
  getTaskFocusMinutes,
}: TodayTaskQueueProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4" aria-label="今日待执行队列">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-extrabold text-sm text-slate-700">今日待执行队列</h4>
        <span className="text-[10px] font-bold text-slate-400">{tasks.length} 项</span>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <TodayTimelineTaskNode
            key={task.id}
            task={task}
            category={categories.find((category) => category.id === task.categoryId)}
            focusMinutes={getTaskFocusMinutes(task.id)}
            isActiveTask={runningSession?.taskId === task.id}
            primaryColor={primaryColor}
            handleStartSession={handleStartSession}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
          />
        ))}
      </div>
    </section>
  );
}
