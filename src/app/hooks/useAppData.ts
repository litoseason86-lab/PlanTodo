import {useCallback, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../shared/domain/entities';
import {toIsoDate} from '../../../shared/lib/date';
import {categoriesApi} from '../../modules/categories/api/categoriesApi';
import {focusApi} from '../../modules/focus/api/focusApi';
import {tasksApi} from '../../modules/tasks/api/tasksApi';

export function useAppData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDateSessions, setSelectedDateSessions] = useState<TaskExecutionSession[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

  const refreshCategories = useCallback(async () => {
    const data = await categoriesApi.getCategories();
    setCategories(data);
    return data;
  }, []);

  const refreshAllTasks = useCallback(async () => {
    const data = await tasksApi.getTasks();
    setAllTasks(data);
    return data;
  }, []);

  const loadTasksForSelectedDate = useCallback(async () => {
    const data = await tasksApi.getTasks({date: selectedDate});
    setTasks(data);
    const sessionData = await focusApi.getSessions({date: selectedDate});
    setSelectedDateSessions(sessionData);
    return {tasks: data, sessions: sessionData};
  }, [selectedDate]);

  const loadMetaData = useCallback(async () => {
    setLoading(true);
    try {
      const catsData = await categoriesApi.getCategories();
      setCategories(catsData);
      const tasksData = await tasksApi.getTasks({date: selectedDate});
      setTasks(tasksData);
      const all = await tasksApi.getTasks();
      setAllTasks(all);
      return {categories: catsData, tasks: tasksData, allTasks: all};
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  return {
    categories,
    tasks,
    selectedDateSessions,
    allTasks,
    loading,
    setLoading,
    selectedDate,
    setSelectedDate,
    refreshCategories,
    refreshAllTasks,
    loadTasksForSelectedDate,
    loadMetaData,
  };
}
