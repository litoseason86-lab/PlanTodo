import {useCallback, useMemo, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {addIsoDateDays, getWeekStart, toIsoDate} from '../../../../shared/lib/date';
import {focusApi} from '../../focus/api/focusApi';
import {tasksApi} from '../../tasks/api/tasksApi';
import {buildDailyReportMetrics} from './useDailyReportController';
import {buildWeeklyReviewMetrics} from './useWeeklyReviewController';

interface WeeklyDayData {
  day: string;
  tasks: Task[];
  sessions: TaskExecutionSession[];
}

interface UseReportStatsControllerArgs {
  categories: Category[];
  allTasks: Task[];
}

function getCurrentWeekStartDate() {
  return getWeekStart(toIsoDate(new Date()));
}

export function useReportStatsController({categories, allTasks}: UseReportStatsControllerArgs) {
  const [dailyReportDate, setDailyReportDate] = useState(() => toIsoDate(new Date()));
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [dailySessions, setDailySessions] = useState<TaskExecutionSession[]>([]);
  const [prevDailySessions, setPrevDailySessions] = useState<TaskExecutionSession[]>([]);
  const [dailyStatsLoaded, setDailyStatsLoaded] = useState(false);
  const [weeklyStartDate, setWeeklyStartDate] = useState(getCurrentWeekStartDate);
  const [weeklyDaysData, setWeeklyDaysData] = useState<WeeklyDayData[]>([]);
  const [weeklyStatsLoaded, setWeeklyStatsLoaded] = useState(false);

  const loadDailyStats = useCallback(async () => {
    setDailyStatsLoaded(false);
    try {
      const tList = await tasksApi.getTasks({date: dailyReportDate});
      setDailyTasks(tList);
      const sList = await focusApi.getSessions({date: dailyReportDate});
      setDailySessions(sList);
      const yesterdayStr = addIsoDateDays(dailyReportDate, -1);
      setPrevDailySessions(await focusApi.getSessions({date: yesterdayStr}));
      setDailyStatsLoaded(true);
    } catch (err) {
      console.error('Daily stats loading failure', err);
    }
  }, [dailyReportDate]);

  const loadWeeklyStats = useCallback(async () => {
    setWeeklyStatsLoaded(false);
    try {
      const days = Array.from({length: 7}, (_, i) => {
        return addIsoDateDays(weeklyStartDate, i);
      });

      const dayLoads = await Promise.all(days.map(async (day) => {
        const tList = await tasksApi.getTasks({date: day});
        const sList = await focusApi.getSessions({date: day});
        return {day, tasks: tList, sessions: sList};
      }));

      setWeeklyDaysData(dayLoads);
      setWeeklyStatsLoaded(true);
    } catch (err) {
      console.error('Weekly stats loading error', err);
    }
  }, [weeklyStartDate]);

  const dailyMetrics = useMemo(
    () => buildDailyReportMetrics({categories, dailyTasks, allTasks, dailySessions, prevDailySessions}),
    [categories, dailyTasks, allTasks, dailySessions, prevDailySessions],
  );

  const weeklyMetrics = useMemo(
    () => buildWeeklyReviewMetrics({categories, weeklyDaysData}),
    [categories, weeklyDaysData],
  );

  return {
    dailyReportDate,
    setDailyReportDate,
    dailyTasks,
    dailySessions,
    dailyStatsLoaded,
    weeklyStartDate,
    setWeeklyStartDate,
    weeklyStatsLoaded,
    dailyMetrics,
    weeklyMetrics,
    loadDailyStats,
    loadWeeklyStats,
  };
}
