import {expect, it} from 'vitest';

import {
  CALENDAR_TASK_DND_MIME,
  readCalendarDragPayload,
  writeCalendarDragPayload,
} from './schedulingDrag';

function dataTransfer() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

it('writes and reads a single task payload through the dedicated MIME', () => {
  const data = dataTransfer();
  writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 3, source: 'sidebar'});
  expect(data.getData(CALENDAR_TASK_DND_MIME)).toContain('"calendar-task"');
  expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 3, source: 'sidebar'});
});

it('reads legacy json task payloads as calendar tasks', () => {
  const data = dataTransfer();
  data.setData('application/json', JSON.stringify({taskId: 8}));
  expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 8, source: 'calendar'});
});

it('reads legacy json timed payloads without losing duration', () => {
  const data = dataTransfer();
  data.setData('application/json', JSON.stringify({taskId: 9, durationMinutes: 90}));
  expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-timed-task', taskId: 9, durationMinutes: 90});
});

it('reads text/plain numeric payloads as calendar tasks', () => {
  const data = dataTransfer();
  data.setData('text/plain', '12');
  expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 12, source: 'calendar'});
});

it('rejects invalid or empty payloads', () => {
  const invalidJson = dataTransfer();
  invalidJson.setData('application/json', '{bad json');
  expect(readCalendarDragPayload(invalidJson)).toBeUndefined();

  const emptyBatch = dataTransfer();
  writeCalendarDragPayload(emptyBatch, {type: 'calendar-task-batch', taskIds: [], source: 'sidebar'});
  expect(readCalendarDragPayload(emptyBatch)).toBeUndefined();

  const nonFinite = dataTransfer();
  nonFinite.setData('text/plain', 'NaN');
  expect(readCalendarDragPayload(nonFinite)).toBeUndefined();
});
