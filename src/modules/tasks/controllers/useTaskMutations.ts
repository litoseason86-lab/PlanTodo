import type React from 'react';

import type {Task} from '../../../../shared/domain/entities';
import type {TaskPriority} from '../../../../shared/domain/status';
import {tasksApi} from '../api/tasksApi';

export interface CreateTaskInput {
  title: string;
  categoryId: number;
  plannedDate?: string;
  tagIds: number[];
  priority: TaskPriority | null;
}

export interface UpdateTaskDetailsInput {
  taskId: number;
  title: string;
  categoryId: number;
  tagIds: number[];
  priority: TaskPriority | null;
}

interface UseTaskMutationsInput {
  refreshAllTasks: () => Promise<Task[]>;
  loadTasksForSelectedDate: () => Promise<unknown>;
  stopRunningSessionForTask: (taskId: number) => Promise<void>;
  refreshReports: () => Promise<void>;
}

async function runAllAndThrowFirst(tasks: Array<() => Promise<unknown>>): Promise<void> {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  const firstRejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (firstRejected) {
    throw firstRejected.reason;
  }
}

export function useTaskMutations({
  refreshAllTasks,
  loadTasksForSelectedDate,
  stopRunningSessionForTask,
  refreshReports,
}: UseTaskMutationsInput) {
  async function createTask(input: CreateTaskInput, event?: React.FormEvent) {
    event?.preventDefault();
    await tasksApi.createTask({
      title: input.title,
      categoryId: input.categoryId,
      plannedDate: input.plannedDate,
      priority: input.priority,
      tagIds: input.tagIds,
    });
    await runAllAndThrowFirst([refreshAllTasks, loadTasksForSelectedDate]);
  }

  async function updateTaskDetails(input: UpdateTaskDetailsInput) {
    await tasksApi.updateTaskDetails(input.taskId, {
      title: input.title,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      priority: input.priority,
    });
    await runAllAndThrowFirst([refreshAllTasks, loadTasksForSelectedDate]);
  }

  async function deleteTask(taskId: number) {
    await tasksApi.deleteTask(taskId);
    await runAllAndThrowFirst([
      () => stopRunningSessionForTask(taskId),
      refreshReports,
      refreshAllTasks,
      loadTasksForSelectedDate,
    ]);
  }

  return {
    createTask,
    updateTaskDetails,
    deleteTask,
  };
}
