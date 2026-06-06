import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {useSchedulingSidebarController} from './useSchedulingSidebarController';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getUnscheduledTasks: vi.fn(),
    getAllDayWithoutTimeTasks: vi.fn(),
  },
}));

function baseArgs(overrides: Partial<Parameters<typeof useSchedulingSidebarController>[0]> = {}) {
  return {
    range: {dateFrom: '2026-06-01', dateTo: '2026-06-07'},
    externalRefreshKey: 0,
    showToast: vi.fn(),
    batchScheduleDate: vi.fn().mockResolvedValue(true),
    batchUnschedule: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('useSchedulingSidebarController', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads unscheduled tasks before all-day-without-time tasks and deduplicates ids', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([{id: 1, title: '未安排'}] as never);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([{id: 1, title: '重复'}, {id: 2, title: '全天'}] as never);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs()));
    await waitFor(() => expect(result.current.tasks.map((task) => task.title)).toEqual(['未安排', '全天']));
  });

  it('passes query and category filters to both task pool requests', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs()));
    act(() => result.current.setQuery(' 方案 '));
    act(() => result.current.setCategoryId('2'));
    await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenLastCalledWith({query: '方案', categoryId: 2}));
    expect(calendarApi.getAllDayWithoutTimeTasks).toHaveBeenLastCalledWith({dateFrom: '2026-06-01', dateTo: '2026-06-07', query: '方案', categoryId: 2});
  });

  it('ignores stale task pool responses', async () => {
    let resolveOld: (tasks: never[]) => void = () => {};
    vi.mocked(calendarApi.getUnscheduledTasks)
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce([{id: 2, title: '新结果'}] as never);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs()));
    act(() => result.current.setQuery('new'));
    await waitFor(() => expect(result.current.tasks).toEqual([{id: 2, title: '新结果'}]));
    await act(async () => resolveOld([{id: 1, title: '旧结果'}] as never));
    expect(result.current.tasks).toEqual([{id: 2, title: '新结果'}]);
  });

  it('does not clear selection when batch scheduling fails', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const batchScheduleDate = vi.fn().mockResolvedValue(false);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs({batchScheduleDate})));
    act(() => result.current.toggleTask(1));
    await act(async () => result.current.batchScheduleSelected('2026-06-08'));
    expect(result.current.selectedTaskIds.has(1)).toBe(true);
  });
});
