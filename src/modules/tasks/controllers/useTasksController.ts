import {useMemo} from 'react';

import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {addIsoDateDays} from '../../../../shared/lib/date';

export interface TaskFilterState {
  category: string;
  status: 'all' | TaskStatus;
  dateScope: 'today' | 'seven-days' | 'all';
  selectedDate: string;
}

export function filterTasks(tasks: Task[], filters: TaskFilterState): Task[] {
  return tasks.filter((task) => {
    if (filters.category !== 'all' && task.categoryId !== Number(filters.category)) {
      return false;
    }

    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }

    if (filters.dateScope === 'today') {
      return task.plannedDate === filters.selectedDate;
    }

    if (filters.dateScope === 'seven-days') {
      const limit = addIsoDateDays(filters.selectedDate, 7);
      return task.plannedDate >= filters.selectedDate && task.plannedDate <= limit;
    }

    return true;
  });
}

export function useTasksController(tasks: Task[], filters: TaskFilterState) {
  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);

  return {
    filteredTasks,
  };
}
