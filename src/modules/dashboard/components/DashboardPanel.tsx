import {ClipboardList} from 'lucide-react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import type {TodayTimelineFlowItem} from '../controllers/todayTimelineFlow';
import type {TodayQuickCreateController} from '../controllers/useTodayQuickCreateController';
import {TodayCurrentAction} from './TodayCurrentAction';
import {TodayFocusFeedback} from './TodayFocusFeedback';
import {TodayQuickCreateBar} from './TodayQuickCreateBar';
import {TodaySummaryHeader} from './TodaySummaryHeader';
import {TodayTaskQueue} from './TodayTaskQueue';
import {TodayTimelineFlow} from './TodayTimelineFlow';

interface DashboardPanelProps {
  styleContext: {
    primary: string;
    primaryLight: string;
    secondary: string;
  };
  categories: Category[];
  tasks: Task[];
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  todayCategoryFocusData: Array<{
    name: string;
    minutes: number;
    color: string;
  }>;
  todayTimelineFlow: TodayTimelineFlowItem[];
  todayTaskQueue: Task[];
  todayQuickCreate: TodayQuickCreateController;
  handleUpdateTaskStatus: (id: number, status: TaskStatus) => void;
  handleStartSession: (task: Task) => void;
  handleStopSession: () => void;
  runningSession: TaskExecutionSession | null;
  lastFinishedSessionTask: Task | null;
  setLastFinishedSessionTask: (task: Task | null) => void;
  getTaskFocusMinutes: (taskId: number) => number;
}

export function DashboardPanel({
  styleContext,
  categories,
  tasks,
  selectedDate,
  setSelectedDate,
  todayCategoryFocusData,
  todayTimelineFlow,
  todayTaskQueue,
  todayQuickCreate,
  handleUpdateTaskStatus,
  handleStartSession,
  handleStopSession,
  runningSession,
  lastFinishedSessionTask,
  setLastFinishedSessionTask,
  getTaskFocusMinutes,
}: DashboardPanelProps) {
  const currentActionTask = runningSession ? tasks.find((task) => task.id === runningSession.taskId) : undefined;
  const hasTimelineItems = todayTimelineFlow.length > 0;
  const hasQueuedTasks = todayTaskQueue.length > 0;
  const hasAnyTasks = tasks.length > 0 || hasTimelineItems || hasQueuedTasks;

  return (
    <div className="space-y-6" id="today_view">
      <TodaySummaryHeader
        primaryColor={styleContext.primary}
        primaryLightColor={styleContext.primaryLight}
        tasks={tasks}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        todayCategoryFocusData={todayCategoryFocusData}
      />

      {lastFinishedSessionTask && (
        <TodayFocusFeedback
          task={lastFinishedSessionTask}
          handleUpdateTaskStatus={handleUpdateTaskStatus}
          setLastFinishedSessionTask={setLastFinishedSessionTask}
        />
      )}

      <TodayQuickCreateBar
        categories={categories}
        primaryColor={styleContext.primary}
        todayQuickCreate={todayQuickCreate}
      />

      {currentActionTask && (
        <TodayCurrentAction
          task={currentActionTask}
          focusMinutes={getTaskFocusMinutes(currentActionTask.id)}
          primaryColor={styleContext.primary}
          onStopSession={handleStopSession}
        />
      )}

      <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h3 className="font-extrabold text-sm text-slate-700 mb-8 border-l-4 pl-3.5" style={{borderColor: styleContext.primary}}>
          行动轨迹轴
        </h3>

        {hasAnyTasks ? (
          <div className="space-y-8">
            {hasTimelineItems && (
              <TodayTimelineFlow
                categories={categories}
                tasks={tasks}
                todayTimelineFlow={todayTimelineFlow}
                runningSession={runningSession}
                primaryColor={styleContext.primary}
                handleStartSession={handleStartSession}
                handleUpdateTaskStatus={handleUpdateTaskStatus}
                getTaskFocusMinutes={getTaskFocusMinutes}
              />
            )}

            {hasQueuedTasks && (
              <TodayTaskQueue
                categories={categories}
                tasks={todayTaskQueue}
                runningSession={runningSession}
                primaryColor={styleContext.primary}
                handleStartSession={handleStartSession}
                handleUpdateTaskStatus={handleUpdateTaskStatus}
                getTaskFocusMinutes={getTaskFocusMinutes}
              />
            )}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{backgroundColor: styleContext.primaryLight}}>
              <ClipboardList className="w-8 h-8 stroke-[1.5]" style={{color: styleContext.primary}} />
            </div>
            <p className="text-sm font-bold text-slate-600">今日暂无行动计划</p>
            <p className="text-xs text-slate-400 mt-1.5">在上方输入框添加你的今日行动项</p>
          </div>
        )}
      </div>
    </div>
  );
}
