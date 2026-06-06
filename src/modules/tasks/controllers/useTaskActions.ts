import {useMemo, useState, type FormEvent} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {toIsoDate} from '../../../../shared/lib/date';
import {getErrorMessage} from '../../../app/errors';
import {tasksApi} from '../api/tasksApi';
import {filterTasks} from './useTasksController';

type AppTab = 'today' | 'tasks' | 'categories' | 'calendar' | 'daily' | 'weekly' | 'focus';

interface UseTaskActionsArgs {
  categories: Category[];
  allTasks: Task[];
  selectedDate: string;
  activeTab: AppTab;
  runningSession: TaskExecutionSession | null;
  lastFinishedSessionTask: Task | null;
  setRunningSession: (session: TaskExecutionSession | null) => void;
  setLastFinishedSessionTask: (task: Task | null) => void;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  loadTasksForSelectedDate: () => Promise<unknown>;
  refreshAllTasks: () => Promise<Task[]>;
  loadDailyStats: () => Promise<void>;
  loadWeeklyStats: () => Promise<void>;
}

export function useTaskActions({
  categories,
  allTasks,
  selectedDate,
  activeTab,
  runningSession,
  lastFinishedSessionTask,
  setRunningSession,
  setLastFinishedSessionTask,
  setLoading,
  showToast,
  loadTasksForSelectedDate,
  refreshAllTasks,
  loadDailyStats,
  loadWeeklyStats,
}: UseTaskActionsArgs) {
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormCategory, setTaskFormCategory] = useState(0);
  const [taskFormDate, setTaskFormDate] = useState(() => toIsoDate(new Date()));
  const [taskFormUnscheduled, setTaskFormUnscheduled] = useState(activeTab === 'tasks');
  const [taskFilterCategory, setTaskFilterCategory] = useState('all');
  const [taskFilterStatus, setTaskFilterStatus] = useState('all');
  const [taskFilterDateScope, setTaskFilterDateScope] = useState<'today' | 'seven-days' | 'all' | 'unscheduled'>('today');

  const filteredTaskItems = useMemo(
    () => filterTasks(allTasks, {
      category: taskFilterCategory,
      status: taskFilterStatus as 'all' | TaskStatus,
      dateScope: taskFilterDateScope,
      selectedDate,
    }),
    [allTasks, taskFilterCategory, taskFilterStatus, taskFilterDateScope, selectedDate],
  );

  function setDefaultTaskCategory(categoryId: number) {
    setTaskFormCategory((current) => current || categoryId);
  }

  async function handleCreateTask(event?: FormEvent) {
    if (event) event.preventDefault();
    if (!taskFormTitle.trim()) {
      showToast('行动主题不能留空啦', 'error');
      return;
    }
    const catId = taskFormCategory || (categories.length > 0 ? categories[0].id : 0);
    if (!catId) {
      showToast('请先新建至少一个分类板块', 'error');
      return;
    }

    try {
      setLoading(true);
      await tasksApi.createTask({
        title: taskFormTitle,
        categoryId: catId,
        plannedDate: taskFormUnscheduled ? undefined : taskFormDate,
      });
      showToast('任务已成功下派！');
      setTaskFormTitle('');
      await refreshAllTasks();
      if (!taskFormUnscheduled && taskFormDate === selectedDate) {
        await loadTasksForSelectedDate();
      }
    } catch (err) {
      showToast(getErrorMessage(err, '生成行动项失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTaskStatus(id: number, status: TaskStatus) {
    try {
      await tasksApi.updateTaskStatus(id, status);
      if (runningSession?.taskId === id && status !== 'IN_PROGRESS') {
        setRunningSession(null);
      }
      showToast('进展转换完美同步');
      await loadTasksForSelectedDate();
      await refreshAllTasks();
      if (activeTab === 'daily') await loadDailyStats();
      if (activeTab === 'weekly') await loadWeeklyStats();
    } catch (err) {
      showToast(getErrorMessage(err, '更新状态故障'), 'error');
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(`确定删除「${task.title}」？关联专注记录也会同步删除。`)) return;

    try {
      setLoading(true);
      await tasksApi.deleteTask(task.id);
      if (runningSession?.taskId === task.id) {
        setRunningSession(null);
      }
      if (lastFinishedSessionTask?.id === task.id) {
        setLastFinishedSessionTask(null);
      }
      showToast('任务已删除');
      await loadTasksForSelectedDate();
      await refreshAllTasks();
      if (activeTab === 'daily') await loadDailyStats();
      if (activeTab === 'weekly') await loadWeeklyStats();
    } catch (err) {
      showToast(getErrorMessage(err, '删除任务失败'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return {
    taskFormTitle,
    taskFormCategory,
    taskFormDate,
    taskFormUnscheduled,
    taskFilterCategory,
    taskFilterStatus,
    taskFilterDateScope,
    filteredTaskItems,
    setTaskFormTitle,
    setTaskFormCategory,
    setDefaultTaskCategory,
    setTaskFormDate,
    setTaskFormUnscheduled,
    setTaskFilterCategory,
    setTaskFilterStatus,
    setTaskFilterDateScope,
    handleCreateTask,
    handleUpdateTaskStatus,
    handleDeleteTask,
  };
}
