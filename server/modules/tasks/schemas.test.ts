import {describe, expect, it} from 'vitest';

import {parseTaskBody, parseTaskQuery, parseTaskScheduleBody} from './schemas';

describe('task schemas', () => {
  it('rejects an invalid planned date in task body', () => {
    expect(() => parseTaskBody({
      title: 'Write',
      categoryId: 1,
      plannedDate: '2026-02-30',
    })).toThrow('plannedDate must be a valid date in YYYY-MM-DD format');
  });

  it('rejects an invalid task query date', () => {
    expect(() => parseTaskQuery({date: '2026-6-5'})).toThrow(
      'date must be a valid date in YYYY-MM-DD format',
    );
  });

  it('parses task date range query', () => {
    expect(parseTaskQuery({dateFrom: '2026-06-01', dateTo: '2026-06-07'})).toMatchObject({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
    });
  });

  it('rejects mixed date and date range task query', () => {
    expect(() => parseTaskQuery({date: '2026-06-06', dateFrom: '2026-06-01', dateTo: '2026-06-07'}))
      .toThrow('Use either date or dateFrom/dateTo');
  });

  it('rejects invalid task schedule body', () => {
    expect(() => parseTaskScheduleBody({
      plannedDate: '2026-06-07',
      plannedEndDate: '2026-06-06',
      allDay: true,
    })).toThrow('plannedEndDate must be after plannedDate');
  });

  it('requires explicit allDay for schedule updates', () => {
    expect(() => parseTaskScheduleBody({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    })).toThrow('allDay must be a boolean');
  });

  it('rejects timed schedules whose date differs from plannedDate', () => {
    expect(() => parseTaskScheduleBody({
      plannedDate: '2026-06-06',
      startAt: '2026-06-07T09:00:00.000',
      endAt: '2026-06-07T10:00:00.000',
      allDay: false,
    })).toThrow('Timed task date must match plannedDate');
  });

  it('parses timed task schedule body', () => {
    expect(parseTaskScheduleBody({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    })).toEqual({
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    });
  });

  it('infers timed task creation when startAt and endAt are provided', () => {
    expect(parseTaskBody({
      title: '会议',
      categoryId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    })).toMatchObject({
      title: '会议',
      categoryId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    });
  });

  it('parses cross-day timed task schedule body', () => {
    expect(parseTaskScheduleBody({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:00:00.000',
      endAt: '2026-06-07T02:00:00.000',
      allDay: false,
    })).toEqual({
      plannedDate: '2026-06-06',
      plannedEndDate: undefined,
      startAt: '2026-06-06T23:00:00.000',
      endAt: '2026-06-07T02:00:00.000',
      allDay: false,
    });
  });
});
