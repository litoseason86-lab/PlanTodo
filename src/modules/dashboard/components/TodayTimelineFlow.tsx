import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import type {TodayTimelineFlowItem} from '../controllers/todayTimelineFlow';
import {TodayTimelineGapNode} from './TodayTimelineGapNode';
import {TodayTimelineTaskNode} from './TodayTimelineTaskNode';

interface TodayTimelineFlowProps {
  categories: Category[];
  tasks: Task[];
  todayTimelineFlow: TodayTimelineFlowItem[];
  runningSession: TaskExecutionSession | null;
  primaryColor: string;
  handleStartSession: (task: Task) => void;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  getTaskFocusMinutes: (taskId: number) => number;
}

function formatTimelineClock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function TodayTimelineFlow({
  categories,
  tasks,
  todayTimelineFlow,
  runningSession,
  primaryColor,
  handleStartSession,
  handleUpdateTaskStatus,
  getTaskFocusMinutes,
}: TodayTimelineFlowProps) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <div className="space-y-4">
      {todayTimelineFlow.map((item) => {
        if (item.type === 'gap') {
          return (
            <TodayTimelineGapNode
              key={`gap-${item.startMinutes}-${item.endMinutes}`}
              startLabel={formatTimelineClock(item.startMinutes)}
              endLabel={formatTimelineClock(item.endMinutes)}
              durationMinutes={item.durationMinutes}
            />
          );
        }

        const task = taskById.get(item.taskId);

        if (!task) {
          return null;
        }

        return (
          <TodayTimelineTaskNode
            key={`task-${item.taskId}-${item.startMinutes}-${item.endMinutes}`}
            task={task}
            category={categories.find((category) => category.id === task.categoryId)}
            focusMinutes={getTaskFocusMinutes(task.id)}
            isActiveTask={runningSession?.taskId === task.id}
            primaryColor={primaryColor}
            timeLabel={formatTimelineClock(item.startMinutes)}
            handleStartSession={handleStartSession}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
          />
        );
      })}
    </div>
  );
}
