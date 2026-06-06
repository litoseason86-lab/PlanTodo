export const CALENDAR_TASK_DND_MIME = 'application/x-plantodo-calendar-task';

export type CalendarDragPayload =
  | {type: 'calendar-task'; taskId: number; source: 'sidebar' | 'task-list' | 'calendar'}
  | {type: 'calendar-task-batch'; taskIds: number[]; source: 'sidebar' | 'task-list'}
  | {type: 'calendar-timed-task'; taskId: number; durationMinutes: number};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizePayload(value: unknown): CalendarDragPayload | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Partial<CalendarDragPayload> & {
    taskId?: unknown;
    taskIds?: unknown;
    durationMinutes?: unknown;
    source?: unknown;
    type?: unknown;
  };

  if (payload.type === 'calendar-task') {
    if (!isPositiveInteger(payload.taskId)) return undefined;
    if (!['sidebar', 'task-list', 'calendar'].includes(String(payload.source))) return undefined;
    return {type: 'calendar-task', taskId: payload.taskId, source: payload.source as 'sidebar' | 'task-list' | 'calendar'};
  }

  if (payload.type === 'calendar-task-batch') {
    if (!Array.isArray(payload.taskIds) || payload.taskIds.length === 0) return undefined;
    if (!payload.taskIds.every(isPositiveInteger)) return undefined;
    if (!['sidebar', 'task-list'].includes(String(payload.source))) return undefined;
    return {type: 'calendar-task-batch', taskIds: [...new Set(payload.taskIds)], source: payload.source as 'sidebar' | 'task-list'};
  }

  if (payload.type === 'calendar-timed-task') {
    if (!isPositiveInteger(payload.taskId) || !isPositiveInteger(payload.durationMinutes)) return undefined;
    return {type: 'calendar-timed-task', taskId: payload.taskId, durationMinutes: payload.durationMinutes};
  }

  if (isPositiveInteger(payload.taskId)) {
    if (isPositiveInteger(payload.durationMinutes)) {
      return {type: 'calendar-timed-task', taskId: payload.taskId, durationMinutes: payload.durationMinutes};
    }
    return {type: 'calendar-task', taskId: payload.taskId, source: 'calendar'};
  }

  return undefined;
}

export function writeCalendarDragPayload(dataTransfer: DataTransfer, payload: CalendarDragPayload): void {
  const serialized = JSON.stringify(payload);
  dataTransfer.setData(CALENDAR_TASK_DND_MIME, serialized);
  dataTransfer.setData('application/json', serialized);
  if (payload.type === 'calendar-task') {
    dataTransfer.setData('text/plain', String(payload.taskId));
  } else if (payload.type === 'calendar-task-batch') {
    dataTransfer.setData('text/plain', payload.taskIds.join(','));
  } else {
    dataTransfer.setData('text/plain', String(payload.taskId));
  }
}

export function readCalendarDragPayload(dataTransfer: DataTransfer): CalendarDragPayload | undefined {
  const dedicated = dataTransfer.getData(CALENDAR_TASK_DND_MIME);
  if (dedicated) {
    const parsed = normalizePayload(parseJson(dedicated));
    if (parsed) return parsed;
    return undefined;
  }

  const legacyJson = dataTransfer.getData('application/json');
  if (legacyJson) {
    const parsed = normalizePayload(parseJson(legacyJson));
    if (parsed) return parsed;
    return undefined;
  }

  const text = dataTransfer.getData('text/plain').trim();
  if (!/^[1-9]\d*$/.test(text)) {
    return undefined;
  }

  return {type: 'calendar-task', taskId: Number.parseInt(text, 10), source: 'calendar'};
}
