import {describe, expect, it} from 'vitest';

import {
  mapCategoryRow,
  mapDailyReportRow,
  mapSessionRow,
  mapTaskRow,
  mapWeeklyReviewRow,
} from './rowMappers';

describe('sqlite row mappers', () => {
  it('maps snake_case rows into domain entities', () => {
    expect(
      mapCategoryRow({
        id: 1,
        user_id: 1,
        name: '工作',
        color: '#ef4444',
        sort_order: 10,
        created_at: '2026-06-05T00:00:00.000Z',
        updated_at: '2026-06-05T00:00:00.000Z',
      }),
    ).toEqual({
      id: 1,
      userId: 1,
      name: '工作',
      color: '#ef4444',
      sortOrder: 10,
      createdAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(
      mapTaskRow({
        id: 2,
        user_id: 1,
        category_id: 1,
        title: '写方案',
        planned_date: '2026-06-05',
        status: 'TODO',
        created_at: '2026-06-05T00:00:00.000Z',
        updated_at: '2026-06-05T00:00:00.000Z',
      }).categoryId,
    ).toBe(1);

    expect(
      mapSessionRow({
        id: 3,
        task_id: 2,
        user_id: 1,
        started_at: '2026-06-05T01:00:00.000Z',
        ended_at: null,
        duration_seconds: null,
        paused_at: '2026-06-05T01:10:00.000Z',
        accumulated_pause_seconds: 60,
        status: 'RUNNING',
        created_at: '2026-06-05T01:00:00.000Z',
        task_title: null,
      }),
    ).toMatchObject({
      endedAt: undefined,
      pausedAt: '2026-06-05T01:10:00.000Z',
      accumulatedPauseSeconds: 60,
    });

    expect(
      mapDailyReportRow({
        id: 4,
        user_id: 1,
        report_date: '2026-06-05',
        content: '日报',
        generator_type: 'RULE_BASED',
        created_at: '2026-06-05T00:00:00.000Z',
        updated_at: '2026-06-05T00:00:00.000Z',
      }).reportDate,
    ).toBe('2026-06-05');

    expect(
      mapWeeklyReviewRow({
        id: 5,
        user_id: 1,
        week_start_date: '2026-06-01',
        week_end_date: '2026-06-07',
        content: '周报',
        generator_type: 'RULE_BASED',
        created_at: '2026-06-05T00:00:00.000Z',
        updated_at: '2026-06-05T00:00:00.000Z',
      }).weekStartDate,
    ).toBe('2026-06-01');
  });
});
