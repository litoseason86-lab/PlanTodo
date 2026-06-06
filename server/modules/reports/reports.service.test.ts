import {describe, expect, it, vi} from 'vitest';

import {ReportsService} from './service';

describe('ReportsService', () => {
  it('builds a daily report from tasks and sessions', () => {
    const saveDaily = vi.fn((_userId: number, _date: string, content: string) => ({
      id: 1,
      userId: 1,
      reportDate: '2026-06-05',
      content,
      generatorType: 'RULE_BASED' as const,
      createdAt: '',
      updatedAt: '',
    }));
    const service = new ReportsService(
      {
        getDaily: vi.fn(),
        saveDaily,
        getWeekly: vi.fn(),
        saveWeekly: vi.fn(),
      },
      {
        listByFilters: vi.fn(() => [
          {
            id: 1,
            userId: 1,
            categoryId: 1,
            title: '任务A',
            plannedDate: '2026-06-05',
            allDay: true,
            status: 'DONE' as const,
            createdAt: '',
            updatedAt: '',
          },
        ]),
        getById: vi.fn(() => ({
          id: 1,
          userId: 1,
          categoryId: 1,
          title: '任务A',
          plannedDate: '2026-06-05',
          allDay: true,
          status: 'DONE' as const,
          createdAt: '',
          updatedAt: '',
        })),
      },
      {
        listByUser: vi.fn(() => [
          {
            id: 1,
            userId: 1,
            name: '工作',
            color: '#fff',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]),
      },
      {
        listByDateRange: vi.fn(() => [
          {
            id: 1,
            taskId: 1,
            userId: 1,
            startedAt: '2026-06-05T00:00:00.000Z',
            endedAt: '2026-06-05T00:30:00.000Z',
            durationSeconds: 1800,
            status: 'COMPLETED' as const,
            createdAt: '',
          },
          {
            id: 2,
            taskId: 1,
            userId: 1,
            startedAt: '2026-06-05T01:00:00.000Z',
            endedAt: '2026-06-05T01:04:59.000Z',
            durationSeconds: 299,
            status: 'COMPLETED' as const,
            createdAt: '',
          },
        ]),
      },
    );

    const report = service.generateDaily(1, '2026-06-05');

    expect(report.content).toContain('每日执行状态报告');
    expect(report.content).toContain('今日累计专注时间**： 0小时 30分钟');
    expect(report.content).toContain('累计专注于其 30 分钟');
    expect(report.content).not.toContain('34分钟');
    expect(saveDaily).toHaveBeenCalledOnce();
  });

  it('loads daily focus sessions by China calendar day boundaries', () => {
    const saveDaily = vi.fn((_userId: number, _date: string, content: string) => ({
      id: 1,
      userId: 1,
      reportDate: '2026-06-05',
      content,
      generatorType: 'RULE_BASED' as const,
      createdAt: '',
      updatedAt: '',
    }));
    const listByDateRange = vi.fn(() => []);
    const service = new ReportsService(
      {
        getDaily: vi.fn(),
        saveDaily,
        getWeekly: vi.fn(),
        saveWeekly: vi.fn(),
      },
      {
        listByFilters: vi.fn(() => []),
        getById: vi.fn(),
      },
      {
        listByUser: vi.fn(() => []),
      },
      {
        listByDateRange,
      },
    );

    service.generateDaily(1, '2026-06-05');

    expect(listByDateRange).toHaveBeenCalledWith(
      1,
      '2026-06-04T16:00:00.000Z',
      '2026-06-05T15:59:59.999Z',
    );
  });
});
