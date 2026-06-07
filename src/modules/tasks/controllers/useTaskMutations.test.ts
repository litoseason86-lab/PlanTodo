import {act, renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {tasksApi} from '../api/tasksApi';
import {useTaskMutations} from './useTaskMutations';

vi.mock('../api/tasksApi', () => ({
  tasksApi: {
    createTask: vi.fn(),
    updateTaskDetails: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

describe('useTaskMutations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates task details then refreshes affected task lists', async () => {
    const refreshAllTasks = vi.fn().mockResolvedValue([]);
    const loadTasksForSelectedDate = vi.fn().mockResolvedValue({tasks: [], sessions: []});
    const {result} = renderHook(() => useTaskMutations({
      refreshAllTasks,
      loadTasksForSelectedDate,
      stopRunningSessionForTask: vi.fn().mockResolvedValue(undefined),
      refreshReports: vi.fn().mockResolvedValue(undefined),
    }));

    await act(async () => {
      await result.current.updateTaskDetails({
        taskId: 1,
        title: '新标题',
        categoryId: 1,
        tagIds: [],
        priority: null,
      });
    });

    expect(tasksApi.updateTaskDetails).toHaveBeenCalledWith(1, {
      title: '新标题',
      categoryId: 1,
      tagIds: [],
      priority: null,
    });
    expect(refreshAllTasks).toHaveBeenCalledOnce();
    expect(loadTasksForSelectedDate).toHaveBeenCalledOnce();
  });

  it('still reloads selected-date tasks when refreshing all tasks fails after details update', async () => {
    const refreshAllTasks = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const loadTasksForSelectedDate = vi.fn().mockResolvedValue({tasks: [], sessions: []});
    const {result} = renderHook(() => useTaskMutations({
      refreshAllTasks,
      loadTasksForSelectedDate,
      stopRunningSessionForTask: vi.fn().mockResolvedValue(undefined),
      refreshReports: vi.fn().mockResolvedValue(undefined),
    }));

    await expect(result.current.updateTaskDetails({
      taskId: 1,
      title: '新标题',
      categoryId: 1,
      tagIds: [],
      priority: null,
    })).rejects.toThrow('refresh failed');

    expect(refreshAllTasks).toHaveBeenCalledOnce();
    expect(loadTasksForSelectedDate).toHaveBeenCalledOnce();
  });

  it('deletes a task through lifecycle callbacks', async () => {
    const stopRunningSessionForTask = vi.fn().mockResolvedValue(undefined);
    const refreshReports = vi.fn().mockResolvedValue(undefined);
    const refreshAllTasks = vi.fn().mockResolvedValue([]);
    const loadTasksForSelectedDate = vi.fn().mockResolvedValue({tasks: [], sessions: []});
    const {result} = renderHook(() => useTaskMutations({
      refreshAllTasks,
      loadTasksForSelectedDate,
      stopRunningSessionForTask,
      refreshReports,
    }));

    await act(async () => {
      await result.current.deleteTask(1);
    });

    expect(tasksApi.deleteTask).toHaveBeenCalledWith(1);
    expect(stopRunningSessionForTask).toHaveBeenCalledWith(1);
    expect(refreshReports).toHaveBeenCalledOnce();
    expect(refreshAllTasks).toHaveBeenCalledOnce();
    expect(loadTasksForSelectedDate).toHaveBeenCalledOnce();
  });

  it('still refreshes task lists when delete side effects fail', async () => {
    const stopRunningSessionForTask = vi.fn().mockRejectedValue(new Error('stop failed'));
    const refreshReports = vi.fn().mockRejectedValue(new Error('reports failed'));
    const refreshAllTasks = vi.fn().mockResolvedValue([]);
    const loadTasksForSelectedDate = vi.fn().mockResolvedValue({tasks: [], sessions: []});
    const {result} = renderHook(() => useTaskMutations({
      refreshAllTasks,
      loadTasksForSelectedDate,
      stopRunningSessionForTask,
      refreshReports,
    }));

    await expect(result.current.deleteTask(1)).rejects.toThrow('stop failed');

    expect(tasksApi.deleteTask).toHaveBeenCalledWith(1);
    expect(stopRunningSessionForTask).toHaveBeenCalledWith(1);
    expect(refreshReports).toHaveBeenCalledOnce();
    expect(refreshAllTasks).toHaveBeenCalledOnce();
    expect(loadTasksForSelectedDate).toHaveBeenCalledOnce();
  });
});
