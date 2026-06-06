import {useCallback, useMemo} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {
  focusSessionDurationSeconds,
  isCountedFocusSession,
  sumCountedFocusSessionSeconds,
} from '../../../../shared/lib/focusSessions';

interface TaskFocusArgs {
  taskId: number;
  selectedDateSessions: TaskExecutionSession[];
  runningSession: TaskExecutionSession | null;
  focusTimeElapsed: number;
}

interface TodayCategoryFocusArgs {
  categories: Category[];
  tasks: Task[];
  allTasks: Task[];
  selectedDateSessions: TaskExecutionSession[];
}

interface DashboardControllerArgs extends TodayCategoryFocusArgs {
  runningSession: TaskExecutionSession | null;
  focusTimeElapsed: number;
}

export function getTaskFocusMinutes({
  taskId,
  selectedDateSessions,
  runningSession,
  focusTimeElapsed,
}: TaskFocusArgs): number {
  const completedSeconds = selectedDateSessions
    .filter((session) => session.taskId === taskId)
    .filter(isCountedFocusSession)
    .reduce((sum, session) => sum + focusSessionDurationSeconds(session), 0);

  const activeSeconds = runningSession?.taskId === taskId ? focusTimeElapsed : 0;

  return Math.round((completedSeconds + activeSeconds) / 60);
}

export function buildTodayCategoryFocusData({
  categories,
  tasks,
  allTasks,
  selectedDateSessions,
}: TodayCategoryFocusArgs) {
  return categories
    .map((category) => {
      const categorySessions = selectedDateSessions.filter((session) => {
        const task =
          tasks.find((currentTask) => currentTask.id === session.taskId) ??
          allTasks.find((currentTask) => currentTask.id === session.taskId);

        return task && task.categoryId === category.id && isCountedFocusSession(session);
      });

      const minutes = Math.round(sumCountedFocusSessionSeconds(categorySessions) / 60);

      return {
        name: category.name,
        minutes,
        color: category.color,
      };
    })
    .filter((item) => item.minutes > 0);
}

export function useDashboardController({
  categories,
  tasks,
  allTasks,
  selectedDateSessions,
  runningSession,
  focusTimeElapsed,
}: DashboardControllerArgs) {
  const todayCategoryFocusData = useMemo(
    () => buildTodayCategoryFocusData({categories, tasks, allTasks, selectedDateSessions}),
    [categories, tasks, allTasks, selectedDateSessions],
  );

  const getTaskFocusMinutesForTask = useCallback(
    (taskId: number) =>
      getTaskFocusMinutes({
        taskId,
        selectedDateSessions,
        runningSession,
        focusTimeElapsed,
      }),
    [selectedDateSessions, runningSession, focusTimeElapsed],
  );

  return {
    todayCategoryFocusData,
    getTaskFocusMinutes: getTaskFocusMinutesForTask,
  };
}
