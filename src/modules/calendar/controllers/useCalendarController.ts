import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {toIsoDate} from '../../../../shared/lib/date';
import {calendarApi} from '../api/calendarApi';
import {getCalendarRange, groupTasksByDate, type CalendarView} from './calendarLayout';
import {
  filterTasksForCalendar,
  loadCalendarSettings,
  saveCalendarSettings,
  type CalendarSettings,
} from './calendarSettings';
import type {CalendarQuickCreateDraft, WeekTimelineDensity} from './weekTimelineInteraction';
import {useTaskSchedulingActions} from './useTaskSchedulingActions';

interface UseCalendarControllerArgs {
  categories: Category[];
  initialDate?: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onMutationSuccess?: () => Promise<void> | void;
}

export function useCalendarController({categories, initialDate, showToast, onMutationSuccess}: UseCalendarControllerArgs) {
  const showToastRef = useRef(showToast);
  const refreshSeqRef = useRef(0);
  const quickCreateDraftSeqRef = useRef(0);
  const [view, setView] = useState<CalendarView>('week');
  const [anchorDate, setAnchorDate] = useState(() => initialDate ?? toIsoDate(new Date()));
  const [settings, setSettingsState] = useState<CalendarSettings>(() => loadCalendarSettings());
  const [quickCreateDraft, setQuickCreateDraft] = useState<CalendarQuickCreateDraft | undefined>();
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [focusSessions, setFocusSessions] = useState<TaskExecutionSession[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getCalendarRange(view, anchorDate), [view, anchorDate]);
  const tasks = useMemo(() => filterTasksForCalendar(rawTasks, settings), [rawTasks, settings]);
  const tasksByDate = useMemo(() => groupTasksByDate(tasks, range.dateFrom, range.dateTo), [tasks, range.dateFrom, range.dateTo]);
  const rangeRef = useRef(range);
  const settingsRef = useRef(settings);

  rangeRef.current = range;
  settingsRef.current = settings;

  const setSettings = useCallback((next: CalendarSettings) => {
    setSettingsState(next);
    saveCalendarSettings(next);
  }, []);

  function openQuickCreateDraft(draft: CalendarQuickCreateDraft): void {
    quickCreateDraftSeqRef.current += 1;
    setQuickCreateDraft(draft);
  }

  function closeQuickCreateDraft(): void {
    quickCreateDraftSeqRef.current += 1;
    setQuickCreateDraft(undefined);
  }

  function setWeekTimelineDensity(density: WeekTimelineDensity): void {
    setSettings({...settingsRef.current, weekTimelineDensity: density});
  }

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const refreshCalendarData = useCallback(async () => {
    const refreshSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = refreshSeq;
    const currentRange = rangeRef.current;
    const currentSettings = settingsRef.current;
    setLoading(true);
    try {
      const categoryId = currentSettings.visibleCategoryIds.length === 1 ? currentSettings.visibleCategoryIds[0] : undefined;
      const [taskData, sessionData] = await Promise.all([
        calendarApi.getCalendarTasks({...currentRange, categoryId}),
        currentSettings.showFocusSessions ? calendarApi.getFocusSessions(currentRange) : Promise.resolve([]),
      ]);
      if (refreshSeq !== refreshSeqRef.current) {
        return;
      }
      setRawTasks(taskData);
      setFocusSessions(sessionData);
    } catch (error) {
      if (refreshSeq === refreshSeqRef.current) {
        showToastRef.current(error instanceof Error ? error.message : '日历数据加载失败', 'error');
      }
    } finally {
      if (refreshSeq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshCalendarData();
  }, [refreshCalendarData, range, settings.showFocusSessions, settings.visibleCategoryIds]);

  const schedulingActions = useTaskSchedulingActions({
    showToast,
    refreshCalendarData,
    onMutationSuccess,
  });

  async function scheduleTaskForDate(taskId: number, plannedDate: string) {
    return schedulingActions.scheduleDate({taskId, date: plannedDate});
  }

  async function scheduleTaskAtTime(input: {taskId: number; date: string; hour: number; minute: number}) {
    return schedulingActions.scheduleTime(input);
  }

  async function moveTimedTask(input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}) {
    return schedulingActions.moveTimedTask(input);
  }

  async function resizeTimedTask(input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}) {
    return schedulingActions.resizeTimedTask(input);
  }

  async function createAllDayTask(plannedDate: string, title = '新任务') {
    const categoryId = categories[0]?.id;
    if (!categoryId) {
      showToastRef.current('请先创建分类', 'error');
      return;
    }

    try {
      await calendarApi.createCalendarTask({
        title,
        categoryId,
        plannedDate,
        allDay: true,
      });
      await refreshCalendarData();
      await onMutationSuccess?.();
    } catch (error) {
      showToastRef.current(error instanceof Error ? error.message : '任务创建失败', 'error');
    }
  }

  async function submitQuickCreateDraft(input: {title: string; categoryId: number}): Promise<{ok: true} | {ok: false; message: string}> {
    if (!quickCreateDraft) {
      return {ok: false, message: '没有可创建的任务'};
    }
    const title = input.title.trim();
    if (!title) {
      return {ok: false, message: '请输入任务标题'};
    }
    const draft = quickCreateDraft;
    const submitDraftSeq = quickCreateDraftSeqRef.current;

    try {
      if (draft.kind === 'all-day') {
        await calendarApi.createCalendarTask({
          title,
          categoryId: input.categoryId,
          plannedDate: draft.plannedDate,
          plannedEndDate: draft.plannedEndDate,
          startAt: undefined,
          endAt: undefined,
          allDay: true,
        });
      } else {
        await calendarApi.createCalendarTask({
          title,
          categoryId: input.categoryId,
          plannedDate: draft.plannedDate,
          plannedEndDate: undefined,
          startAt: draft.startAt,
          endAt: draft.endAt,
          allDay: false,
        });
      }
    } catch (error) {
      return {ok: false, message: error instanceof Error ? error.message : '任务创建失败'};
    }

    if (submitDraftSeq === quickCreateDraftSeqRef.current) {
      setQuickCreateDraft(undefined);
    }
    try {
      await refreshCalendarData();
    } catch (error) {
      showToastRef.current(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    try {
      await onMutationSuccess?.();
    } catch (error) {
      showToastRef.current(error instanceof Error ? error.message : '日历数据刷新失败', 'error');
    }
    return {ok: true};
  }

  return {
    view,
    setView,
    anchorDate,
    setAnchorDate,
    range,
    settings,
    setSettings,
    setWeekTimelineDensity,
    quickCreateDraft,
    openQuickCreateDraft,
    closeQuickCreateDraft,
    submitQuickCreateDraft,
    categories,
    rawTasks,
    tasks,
    tasksByDate,
    focusSessions,
    loading,
    refreshCalendarData,
    createAllDayTask,
    scheduleTaskForDate,
    scheduleTaskAtTime,
    moveTimedTask,
    resizeTimedTask,
    batchScheduleDate: schedulingActions.batchScheduleDate,
    batchUnschedule: schedulingActions.batchUnschedule,
  };
}
