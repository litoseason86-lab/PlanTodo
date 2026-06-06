import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {Task} from '../../../../shared/domain/entities';
import type {CalendarRange} from '../api/calendarApi';
import {calendarApi} from '../api/calendarApi';
import {clearSelection, selectAllVisible, toggleTaskSelection} from './schedulingSelection';

interface UseSchedulingSidebarControllerArgs {
  range: CalendarRange;
  externalRefreshKey: number;
  showToast: (message: string, type?: 'success' | 'error') => void;
  batchScheduleDate: (input: {taskIds: number[]; date: string}) => Promise<boolean>;
  batchUnschedule: (input: {taskIds: number[]}) => Promise<boolean>;
}

function dedupeTasks(tasks: Task[]): Task[] {
  const seen = new Set<number>();
  const result: Task[] = [];
  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    seen.add(task.id);
    result.push(task);
  }
  return result;
}

function parseCategoryId(value: string): number | undefined {
  if (value === 'all') return undefined;
  const categoryId = Number.parseInt(value, 10);
  return Number.isSafeInteger(categoryId) && categoryId > 0 ? categoryId : undefined;
}

export function useSchedulingSidebarController({
  range,
  externalRefreshKey,
  showToast,
  batchScheduleDate,
  batchUnschedule,
}: UseSchedulingSidebarControllerArgs) {
  const refreshSeqRef = useRef(0);
  const showToastRef = useRef(showToast);
  const batchScheduleDateRef = useRef(batchScheduleDate);
  const batchUnscheduleRef = useRef(batchUnschedule);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQueryState] = useState('');
  const [categoryId, setCategoryIdState] = useState('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(() => new Set());
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(range.dateFrom);

  const queryFilter = query.trim();
  const numericCategoryId = parseCategoryId(categoryId);
  const {dateFrom, dateTo} = range;

  useEffect(() => {
    showToastRef.current = showToast;
    batchScheduleDateRef.current = batchScheduleDate;
    batchUnscheduleRef.current = batchUnschedule;
  }, [batchScheduleDate, batchUnschedule, showToast]);

  const refresh = useCallback(async () => {
    const refreshSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = refreshSeq;
    setLoading(true);
    try {
      const taskFilters = {
        ...(queryFilter ? {query: queryFilter} : {}),
        ...(numericCategoryId ? {categoryId: numericCategoryId} : {}),
      };
      const [unscheduledTasks, allDayTasks] = await Promise.all([
        calendarApi.getUnscheduledTasks(taskFilters),
        calendarApi.getAllDayWithoutTimeTasks({dateFrom, dateTo, ...taskFilters}),
      ]);
      if (refreshSeq !== refreshSeqRef.current) return;
      setTasks(dedupeTasks([...unscheduledTasks, ...allDayTasks]));
    } catch (error) {
      if (refreshSeq === refreshSeqRef.current) {
        showToastRef.current(error instanceof Error ? error.message : '安排任务加载失败', 'error');
      }
    } finally {
      if (refreshSeq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo, numericCategoryId, queryFilter]);

  useEffect(() => {
    setSelectedTaskIds(clearSelection());
    void refresh();
  }, [refresh, externalRefreshKey]);

  const setQuery = useCallback((value: string) => {
    setSelectedTaskIds(clearSelection());
    setQueryState(value);
  }, []);

  const setCategoryId = useCallback((value: string) => {
    setSelectedTaskIds(clearSelection());
    setCategoryIdState(value);
  }, []);

  const visibleTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  const toggleTask = useCallback((taskId: number) => {
    setSelectedTaskIds((current) => toggleTaskSelection(current, taskId));
  }, []);

  const selectAllVisibleTasks = useCallback(() => {
    setSelectedTaskIds(selectAllVisible(visibleTaskIds));
  }, [visibleTaskIds]);

  const clearSelected = useCallback(() => {
    setSelectedTaskIds(clearSelection());
  }, []);

  const batchScheduleSelected = useCallback(async (date: string) => {
    const taskIds = [...selectedTaskIds];
    if (taskIds.length === 0) return;
    const success = await batchScheduleDateRef.current({taskIds, date});
    if (!success) return;
    setSelectedTaskIds(clearSelection());
    await refresh();
  }, [refresh, selectedTaskIds]);

  const batchUnscheduleSelected = useCallback(async () => {
    const taskIds = [...selectedTaskIds];
    if (taskIds.length === 0) return;
    const success = await batchUnscheduleRef.current({taskIds});
    if (!success) return;
    setSelectedTaskIds(clearSelection());
    await refresh();
  }, [refresh, selectedTaskIds]);

  return {
    tasks,
    loading,
    query,
    categoryId,
    selectedTaskIds,
    selectedScheduleDate,
    setQuery,
    setCategoryId,
    setSelectedScheduleDate,
    toggleTask,
    selectAllVisible: selectAllVisibleTasks,
    clearSelected,
    batchScheduleSelected,
    batchUnscheduleSelected,
    refresh,
  };
}
