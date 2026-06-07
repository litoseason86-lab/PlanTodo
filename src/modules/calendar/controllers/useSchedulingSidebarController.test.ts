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

const categories = [{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}];
const tags = [
  {id: 1, userId: 1, name: '客户A', createdAt: '', updatedAt: ''},
  {id: 2, userId: 1, name: '项目B', createdAt: '', updatedAt: ''},
];

function baseArgs(overrides: Partial<Parameters<typeof useSchedulingSidebarController>[0]> = {}) {
  return {
    categories,
    tags,
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

  it('passes tag and priority filters to both task pool requests and clears selection', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs()));

    act(() => result.current.toggleTask(1));
    await waitFor(() => expect(result.current.selectedTaskIds.size).toBe(1));

    await act(async () => {
      result.current.setTagIds([1, 2]);
      result.current.setPriority('none');
    });

    await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenLastCalledWith(expect.objectContaining({tagIds: [1, 2], priority: 'none'})));
    expect(calendarApi.getAllDayWithoutTimeTasks).toHaveBeenLastCalledWith(expect.objectContaining({tagIds: [1, 2], priority: 'none'}));
    expect(result.current.selectedTaskIds.size).toBe(0);
  });

  it('does not refetch or clear selection when tag filters are unchanged after normalization', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result} = renderHook(() => useSchedulingSidebarController(baseArgs()));

    act(() => result.current.setTagIds([1, 2]));
    await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenLastCalledWith(expect.objectContaining({tagIds: [1, 2]})));
    const unscheduledCalls = vi.mocked(calendarApi.getUnscheduledTasks).mock.calls.length;
    const allDayCalls = vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mock.calls.length;
    act(() => result.current.toggleTask(1));
    expect(result.current.selectedTaskIds.size).toBe(1);

    act(() => result.current.setTagIds([2, 1, 1]));

    expect(result.current.selectedTaskIds.size).toBe(1);
    expect(calendarApi.getUnscheduledTasks).toHaveBeenCalledTimes(unscheduledCalls);
    expect(calendarApi.getAllDayWithoutTimeTasks).toHaveBeenCalledTimes(allDayCalls);
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

  it('resets the selected schedule date to the new range start when the selected date leaves the range', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result, rerender} = renderHook(
      ({range}) => useSchedulingSidebarController(baseArgs({range})),
      {initialProps: {range: {dateFrom: '2026-06-01', dateTo: '2026-06-07'}}},
    );

    act(() => result.current.setSelectedScheduleDate('2026-06-05'));
    rerender({range: {dateFrom: '2026-06-08', dateTo: '2026-06-14'}});

    await waitFor(() => expect(result.current.selectedScheduleDate).toBe('2026-06-08'));
  });

  it('keeps the selected schedule date when a range change still contains it', async () => {
    vi.mocked(calendarApi.getUnscheduledTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getAllDayWithoutTimeTasks).mockResolvedValue([]);
    const {result, rerender} = renderHook(
      ({range}) => useSchedulingSidebarController(baseArgs({range})),
      {initialProps: {range: {dateFrom: '2026-06-01', dateTo: '2026-06-07'}}},
    );

    act(() => result.current.setSelectedScheduleDate('2026-06-05'));
    rerender({range: {dateFrom: '2026-06-01', dateTo: '2026-06-30'}});

    await waitFor(() => expect(result.current.selectedScheduleDate).toBe('2026-06-05'));
  });
});
