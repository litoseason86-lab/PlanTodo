import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {Category, Tag, Task} from '../../../../shared/domain/entities';
import type {TaskPriority} from '../../../../shared/domain/status';
import type {CalendarRange} from '../api/calendarApi';
import {calendarApi} from '../api/calendarApi';
import {
  groupSchedulingTasks,
  type SchedulingGroupMode,
  uniqueSelectedTaskIds,
} from './schedulingSidebarGrouping';
import {clearSelection, selectAllVisible, toggleTaskSelection} from './schedulingSelection';

interface UseSchedulingSidebarControllerArgs {
  categories: Category[];
  tags: Tag[];
  range: CalendarRange;
  externalRefreshKey: number;
  showToast: (message: string, type?: 'success' | 'error') => void;
  batchScheduleDate: (input: {taskIds: number[]; date: string}) => Promise<boolean>;
  batchUnschedule: (input: {taskIds: number[]}) => Promise<boolean>;
}

type SchedulingPriorityFilter = 'all' | 'none' | TaskPriority;

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

function normalizeTagIds(value: number[]): number[] {
  return [...new Set(value)].sort((left, right) => left - right);
}

function sameNumberArray(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useSchedulingSidebarController({
  categories,
  tags,
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
  const [tagIds, setTagIdsState] = useState<number[]>([]);
  const tagIdsRef = useRef<number[]>([]);
  const [priority, setPriorityState] = useState<SchedulingPriorityFilter>('all');
  const [groupMode, setGroupModeState] = useState<SchedulingGroupMode>('none');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(() => new Set());
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(range.dateFrom);

  const queryFilter = query.trim();
  const numericCategoryId = parseCategoryId(categoryId);
  const priorityFilter = priority === 'all' ? undefined : priority;
  const {dateFrom, dateTo} = range;

  useEffect(() => {
    showToastRef.current = showToast;
    batchScheduleDateRef.current = batchScheduleDate;
    batchUnscheduleRef.current = batchUnschedule;
  }, [batchScheduleDate, batchUnschedule, showToast]);

  useEffect(() => {
    setSelectedScheduleDate((current) => (
      current >= dateFrom && current <= dateTo ? current : dateFrom
    ));
  }, [dateFrom, dateTo]);

  const refresh = useCallback(async () => {
    const refreshSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = refreshSeq;
    setLoading(true);
    try {
      const taskFilters = {
        ...(queryFilter ? {query: queryFilter} : {}),
        ...(numericCategoryId ? {categoryId: numericCategoryId} : {}),
        ...(tagIds.length > 0 ? {tagIds} : {}),
        ...(priorityFilter ? {priority: priorityFilter} : {}),
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
  }, [dateFrom, dateTo, numericCategoryId, priorityFilter, queryFilter, tagIds]);

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

  const setTagIds = useCallback((value: number[]) => {
    const next = normalizeTagIds(value);
    if (sameNumberArray(tagIdsRef.current, next)) {
      return;
    }
    tagIdsRef.current = next;
    setSelectedTaskIds(clearSelection());
    setTagIdsState(next);
  }, []);

  const setPriority = useCallback((value: SchedulingPriorityFilter) => {
    setSelectedTaskIds(clearSelection());
    setPriorityState(value);
  }, []);

  const setGroupMode = useCallback((value: SchedulingGroupMode) => {
    setSelectedTaskIds(clearSelection());
    setGroupModeState(value);
  }, []);

  const visibleTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const groupedTaskGroups = useMemo(
    () => groupSchedulingTasks(tasks, {mode: groupMode, categories, tags}),
    [categories, groupMode, tags, tasks],
  );

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
    const taskIds = uniqueSelectedTaskIds(selectedTaskIds);
    if (taskIds.length === 0) return;
    const success = await batchScheduleDateRef.current({taskIds, date});
    if (!success) return;
    setSelectedTaskIds(clearSelection());
    await refresh();
  }, [refresh, selectedTaskIds]);

  const batchUnscheduleSelected = useCallback(async () => {
    const taskIds = uniqueSelectedTaskIds(selectedTaskIds);
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
    tagIds,
    priority,
    groupMode,
    groupedTaskGroups,
    selectedTaskIds,
    selectedScheduleDate,
    setQuery,
    setCategoryId,
    setTagIds,
    setPriority,
    setGroupMode,
    setSelectedScheduleDate,
    toggleTask,
    selectAllVisible: selectAllVisibleTasks,
    clearSelected,
    batchScheduleSelected,
    batchUnscheduleSelected,
    refresh,
  };
}
