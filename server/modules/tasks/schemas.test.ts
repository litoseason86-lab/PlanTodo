import {describe, expect, it} from 'vitest';

import {
  parseBatchScheduleBody,
  parseBatchUnscheduleBody,
  parseTaskBody,
  parseTaskQuery,
  parseTaskScheduleBody,
} from './schemas';

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

  it('parses task creation without plannedDate as unscheduled', () => {
    expect(parseTaskBody({
      title: '收集资料',
      categoryId: 1,
    })).toEqual({
      title: '收集资料',
      categoryId: 1,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('parses null plannedDate as unscheduled', () => {
    expect(parseTaskBody({
      title: '收集资料',
      categoryId: 1,
      plannedDate: null,
      plannedEndDate: '2026-06-08',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    })).toMatchObject({
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

it('rejects null plannedDate when the caller explicitly requests a timed task', () => {
  expect(() => parseTaskBody({
    title: '收集资料',
      categoryId: 1,
      plannedDate: null,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  })).toThrow('Timed task requires plannedDate');
});

it('rejects omitted plannedDate when schedule details are present', () => {
  expect(() => parseTaskBody({
    title: '收集资料',
    categoryId: 1,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
  })).toThrow('Timed task requires plannedDate');
});

  it('parses empty schedule update body as unscheduled', () => {
    expect(parseTaskScheduleBody({})).toEqual({
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('parses null plannedDate schedule update as unscheduled', () => {
    expect(parseTaskScheduleBody({plannedDate: null})).toEqual({
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('parses schedule update without plannedDate as unscheduled', () => {
    expect(parseTaskScheduleBody({allDay: true})).toEqual({
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

it('rejects timed schedule updates without plannedDate', () => {
  expect(() => parseTaskScheduleBody({
    startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  })).toThrow('Timed task requires plannedDate');
});

it('rejects schedule updates without plannedDate when schedule details are present', () => {
  expect(() => parseTaskScheduleBody({
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
  })).toThrow('Timed task requires plannedDate');
});

  it('rejects cross-day timed task schedule body', () => {
    expect(() => parseTaskScheduleBody({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:00:00.000',
      endAt: '2026-06-07T02:00:00.000',
      allDay: false,
    })).toThrow('Cross-day timed tasks are not supported yet');
  });

  it('parses scheduled and query task filters', () => {
    expect(parseTaskQuery({
      scheduled: 'all-day-without-time',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '  周报  ',
    })).toMatchObject({
      scheduled: 'all-day-without-time',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '周报',
    });
  });

  it('rejects unscheduled filter with date filters', () => {
    expect(() => parseTaskQuery({
      scheduled: 'unscheduled',
      date: '2026-06-06',
    })).toThrow('scheduled=unscheduled cannot be combined with date filters');
  });

  it('parses batch schedule and unschedule bodies', () => {
    expect(parseBatchScheduleBody({taskIds: [1, 2], plannedDate: '2026-06-06'})).toEqual({
      taskIds: [1, 2],
      plannedDate: '2026-06-06',
    });
    expect(parseBatchUnscheduleBody({taskIds: [1, 2]})).toEqual({taskIds: [1, 2]});
  });

  it('rejects duplicate batch task ids', () => {
    expect(() => parseBatchUnscheduleBody({taskIds: [1, 1]})).toThrow('taskIds must be unique');
  });

  it('rejects non-integer batch task ids', () => {
    expect(() => parseBatchUnscheduleBody({taskIds: ['1abc']})).toThrow('taskIds must contain positive integers');
    expect(() => parseBatchUnscheduleBody({taskIds: ['1.9']})).toThrow('taskIds must contain positive integers');
  });
});
