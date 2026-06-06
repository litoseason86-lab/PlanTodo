import {useMemo} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {isCountedFocusSession, sumCountedFocusSessionSeconds} from '../../../../shared/lib/focusSessions';

interface DailyReportMetricsArgs {
  categories: Category[];
  dailyTasks: Task[];
  allTasks: Task[];
  dailySessions: TaskExecutionSession[];
  prevDailySessions: TaskExecutionSession[];
}

export function buildDailyReportMetrics({
  categories,
  dailyTasks,
  allTasks,
  dailySessions,
  prevDailySessions,
}: DailyReportMetricsArgs) {
  const totalDailyCompletedSeconds = sumCountedFocusSessionSeconds(dailySessions);

  const totalPrevDailyCompletedSeconds = sumCountedFocusSessionSeconds(prevDailySessions);

  const dailyTotalMinutes = Math.round(totalDailyCompletedSeconds / 60);
  const prevDailyTotalMinutes = Math.round(totalPrevDailyCompletedSeconds / 60);

  const dailyFocusDeltaPercent =
    prevDailyTotalMinutes === 0
      ? dailyTotalMinutes > 0
        ? 100
        : 0
      : Math.round(((dailyTotalMinutes - prevDailyTotalMinutes) / prevDailyTotalMinutes) * 100);

  const doneDailyTasksCount = dailyTasks.filter((task) => task.status === 'DONE').length;
  const todoDailyTasksCount = dailyTasks.filter((task) => task.status === 'TODO').length;
  const inProgressDailyTasksCount = dailyTasks.filter((task) => task.status === 'IN_PROGRESS').length;
  const notDoneDailyTasksCount = dailyTasks.filter((task) => task.status === 'NOT_DONE').length;

  const dailyCategoryDistributionData = categories
    .map((category) => {
      const categorySessions = dailySessions.filter((session) => {
        const task =
          dailyTasks.find((currentTask) => currentTask.id === session.taskId) ??
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

  return {
    dailyTotalMinutes,
    prevDailyTotalMinutes,
    dailyFocusDeltaPercent,
    doneDailyTasksCount,
    todoDailyTasksCount,
    inProgressDailyTasksCount,
    notDoneDailyTasksCount,
    dailyCategoryDistributionData,
  };
}

export function useDailyReportController(args: DailyReportMetricsArgs) {
  return useMemo(() => buildDailyReportMetrics(args), [args]);
}
