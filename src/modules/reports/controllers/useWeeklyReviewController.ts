import {useMemo} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {getIsoDateWeekday} from '../../../../shared/lib/date';
import {sumCountedFocusSessionSeconds} from '../../../../shared/lib/focusSessions';

interface WeeklyDayData {
  day: string;
  tasks: Task[];
  sessions: TaskExecutionSession[];
}

interface WeeklyReviewMetricsArgs {
  categories: Category[];
  weeklyDaysData: WeeklyDayData[];
}

export function buildWeeklyReviewMetrics({categories, weeklyDaysData}: WeeklyReviewMetricsArgs) {
  const weeklyTotalTasks = weeklyDaysData.reduce((sum, day) => sum + day.tasks.length, 0);
  const weeklyDoneTasks = weeklyDaysData.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.status === 'DONE').length,
    0,
  );
  const weeklyPendingTasks = weeklyDaysData.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.status === 'TODO' || task.status === 'IN_PROGRESS').length,
    0,
  );
  const weeklyOverdueTasks = weeklyDaysData.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.status === 'NOT_DONE').length,
    0,
  );

  const weeklyTotalMins = Math.round(
    weeklyDaysData.reduce((sum, day) => sum + sumCountedFocusSessionSeconds(day.sessions), 0) / 60,
  );

  const weeklyTimelineRateData = weeklyDaysData.map((day) => {
    const total = day.tasks.length;
    const completed = day.tasks.filter((task) => task.status === 'DONE').length;
    const weekdayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    return {
      day: day.day.slice(5),
      weekday: weekdayLabels[getIsoDateWeekday(day.day)],
      rate: total === 0 ? 0 : Math.round((completed / total) * 100),
      total,
      completed,
    };
  });

  const weeklyCategoryDistribution = categories
    .map((category) => {
      const value = weeklyDaysData.reduce(
        (sum, day) => sum + day.tasks.filter((task) => task.categoryId === category.id && task.status === 'DONE').length,
        0,
      );

      return {
        name: category.name,
        value,
        color: category.color,
      };
    })
    .filter((item) => item.value > 0);

  const weeklyStreaks = weeklyDaysData.map((day) => {
    if (day.tasks.length === 0) {
      return false;
    }

    return day.tasks.every((task) => task.status === 'DONE');
  });

  let maxStreak = 0;
  let currentStreak = 0;

  weeklyStreaks.forEach((isDone) => {
    if (isDone) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
      return;
    }

    currentStreak = 0;
  });

  return {
    weeklyTotalTasks,
    weeklyDoneTasks,
    weeklyPendingTasks,
    weeklyOverdueTasks,
    weeklyTotalMins,
    weeklyTimelineRateData,
    weeklyCategoryDistribution,
    weeklyDaysData,
    maxStreak,
  };
}

export function useWeeklyReviewController(args: WeeklyReviewMetricsArgs) {
  return useMemo(() => buildWeeklyReviewMetrics(args), [args]);
}
