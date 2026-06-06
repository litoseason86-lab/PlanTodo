# Calendar Scheduling Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在日历基础视图上补齐一期交互：月视图拖到日期、周视图拖到时间轴生成/移动时间段、调整时间段时长，以及显示专注记录。

**Architecture:** 交互状态仍归 `useCalendarController`，组件只发出明确命令。所有排期更新必须走 controller 的单一 action，再调用 `calendarApi.updateTaskSchedule` 并刷新数据；组件不得直接调用 HTTP API。时间轴布局和拖拽落点换算放在纯 helper 中测试，避免把时间计算散落在 JSX 里。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, HTML drag/drop events, pointer events, Tailwind CSS, lucide-react.

---

## Preconditions

先完成：

1. [calendar-scheduling-backend-plan.md](/Users/zerionlito/code/PlanTodo/docs/superpowers/plans/2026-06-06-calendar-scheduling-backend-plan.md)
2. [calendar-scheduling-frontend-plan.md](/Users/zerionlito/code/PlanTodo/docs/superpowers/plans/2026-06-06-calendar-scheduling-frontend-plan.md)

本计划假设：

- `CalendarPanel`、`MonthCalendarView`、`WeekTimelineView`、`CalendarListView` 已存在。
- `useCalendarController` 已有 `scheduleTaskForDate`、`tasksByDate`、`focusSessions`。
- `shared/lib/schedule.ts` 已有 `makeLocalDateTime`、`addMinutesToLocalDateTime`。
- 后端会拒绝跨天时间段任务。

## File Structure

- Create: `src/modules/calendar/controllers/weekTimelineLayout.ts` - 时间轴分钟换算、任务块位置、drop payload。
- Create: `src/modules/calendar/controllers/weekTimelineLayout.test.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.ts` - 增加时间排期、移动时间段、调整时长、失败 toast。
- Modify: `src/modules/calendar/controllers/useCalendarController.test.ts`
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx` - 明确拖拽 payload，支持拖到日期。
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx` - 时间轴 drop、拖动时间段、调整时长、专注记录块。
- Modify: `src/modules/calendar/components/CalendarListView.tsx` - 专注记录摘要。
- Modify: `src/modules/calendar/components/CalendarPanel.tsx` - 传递新增 actions 和 focus sessions。
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx` - 覆盖交互渲染。

---

### Task 1: Week Timeline Layout Helpers

**Files:**
- Create: `src/modules/calendar/controllers/weekTimelineLayout.ts`
- Create: `src/modules/calendar/controllers/weekTimelineLayout.test.ts`

- [ ] **Step 1: Write failing layout tests**

Create `src/modules/calendar/controllers/weekTimelineLayout.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import {
  buildFocusSessionBlock,
  buildTimedTaskBlock,
  getHourFromDropMinute,
  minutesFromDayStart,
  snapMinutes,
} from './weekTimelineLayout';

describe('weekTimelineLayout', () => {
  it('calculates minutes from local day start', () => {
    expect(minutesFromDayStart('2026-06-06T09:30:00.000')).toBe(570);
  });

  it('builds timed task block dimensions', () => {
    expect(buildTimedTaskBlock({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:15:00.000',
    })).toEqual({topMinutes: 540, durationMinutes: 75});
  });

  it('snaps minutes to 15 minute increments', () => {
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(553)).toBe(555);
  });

  it('gets hour and minute from dropped minute offset', () => {
    expect(getHourFromDropMinute(187)).toEqual({hour: 9, minute: 0});
  });

  it('builds focus session block', () => {
    expect(buildFocusSessionBlock({
      startedAt: '2026-06-06T09:00:00.000Z',
      durationSeconds: 2700,
    })).toMatchObject({durationMinutes: 45});
  });
});
```

- [ ] **Step 2: Run layout test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/weekTimelineLayout.test.ts
```

Expected: FAIL because file does not exist.

- [ ] **Step 3: Implement layout helpers**

Create `src/modules/calendar/controllers/weekTimelineLayout.ts`:

```ts
export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_SLOT_MINUTES = 15;
const CHINA_TIME_ZONE_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface TimedBlockInput {
  startAt: string;
  endAt: string;
}

export interface TimedTaskBlock {
  topMinutes: number;
  durationMinutes: number;
}

export interface FocusSessionBlock {
  topMinutes: number;
  durationMinutes: number;
}

export function minutesFromDayStart(localDateTime: string): number {
  return Number(localDateTime.slice(11, 13)) * 60 + Number(localDateTime.slice(14, 16));
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES;
}

export function getHourFromDropMinute(offsetMinutes: number): {hour: number; minute: number} {
  const total = TIMELINE_START_HOUR * 60 + snapMinutes(offsetMinutes);
  return {
    hour: Math.floor(total / 60),
    minute: total % 60,
  };
}

export function buildTimedTaskBlock(input: TimedBlockInput): TimedTaskBlock {
  const topMinutes = minutesFromDayStart(input.startAt);
  const durationMinutes = Math.max(TIMELINE_SLOT_MINUTES, minutesFromDayStart(input.endAt) - topMinutes);

  return {topMinutes, durationMinutes};
}

export function buildFocusSessionBlock(input: {startedAt: string; durationSeconds?: number}): FocusSessionBlock {
  const started = new Date(new Date(input.startedAt).getTime() + CHINA_TIME_ZONE_OFFSET_MS);
  const topMinutes = started.getUTCHours() * 60 + started.getUTCMinutes();
  const durationMinutes = Math.max(TIMELINE_SLOT_MINUTES, Math.round((input.durationSeconds ?? 0) / 60));

  return {topMinutes, durationMinutes};
}
```

- [ ] **Step 4: Run layout test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/weekTimelineLayout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/weekTimelineLayout.ts src/modules/calendar/controllers/weekTimelineLayout.test.ts
git commit -m "feat: add week timeline interaction layout"
```

---

### Task 2: Controller Scheduling Actions

**Files:**
- Modify: `src/modules/calendar/controllers/useCalendarController.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.test.ts`

- [ ] **Step 1: Add failing controller action tests**

Append to `src/modules/calendar/controllers/useCalendarController.test.ts`:

```ts
it('schedules a task at a specific time with a default 60 minute duration', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

  const {result} = renderHook(() => useCalendarController({
    categories: [],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  await act(async () => {
    await result.current.scheduleTaskAtTime({taskId: 1, date: '2026-06-06', hour: 9, minute: 0});
  });

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
    plannedDate: '2026-06-06',
    plannedEndDate: undefined,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });
});

it('resizes a timed task duration', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

  const {result} = renderHook(() => useCalendarController({
    categories: [],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  await act(async () => {
    await result.current.resizeTimedTask({
      taskId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      durationMinutes: 90,
    });
  });

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
    plannedDate: '2026-06-06',
    plannedEndDate: undefined,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:30:00.000',
    allDay: false,
  });
});

it('shows an error toast when schedule update fails', async () => {
  const showToast = vi.fn();
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.updateTaskSchedule).mockRejectedValue(new Error('endAt must be after startAt'));

  const {result} = renderHook(() => useCalendarController({
    categories: [],
    initialDate: '2026-06-06',
    showToast,
  }));

  await act(async () => {
    await result.current.scheduleTaskAtTime({taskId: 1, date: '2026-06-06', hour: 9, minute: 0});
  });

  expect(showToast).toHaveBeenCalledWith('endAt must be after startAt', 'error');
});
```

- [ ] **Step 2: Run controller test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: FAIL because time scheduling and resizing actions do not exist.

- [ ] **Step 3: Add controller action helpers**

In `src/modules/calendar/controllers/useCalendarController.ts`, import:

```ts
import {addMinutesToLocalDateTime, makeLocalDateTime} from '../../../../shared/lib/schedule';
```

Add helper inside the hook:

```ts
async function persistSchedule(
  taskId: number,
  schedule: {plannedDate: string; plannedEndDate?: string; startAt?: string; endAt?: string; allDay: boolean},
) {
  try {
    await calendarApi.updateTaskSchedule(taskId, schedule);
    await refreshCalendarData();
  } catch (error) {
    showToast(error instanceof Error ? error.message : '排期更新失败', 'error');
  }
}
```

Replace existing `scheduleTaskForDate` body with:

```ts
async function scheduleTaskForDate(taskId: number, plannedDate: string) {
  await persistSchedule(taskId, {
    plannedDate,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  });
}
```

Add:

```ts
async function scheduleTaskAtTime(input: {taskId: number; date: string; hour: number; minute: number}) {
  const startAt = makeLocalDateTime(input.date, input.hour, input.minute);
  const endAt = addMinutesToLocalDateTime(startAt, 60);
  await persistSchedule(input.taskId, {
    plannedDate: input.date,
    plannedEndDate: undefined,
    startAt,
    endAt,
    allDay: false,
  });
}

async function moveTimedTask(input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}) {
  const startAt = makeLocalDateTime(input.date, input.hour, input.minute);
  const endAt = addMinutesToLocalDateTime(startAt, input.durationMinutes);
  await persistSchedule(input.taskId, {
    plannedDate: input.date,
    plannedEndDate: undefined,
    startAt,
    endAt,
    allDay: false,
  });
}

async function resizeTimedTask(input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}) {
  const endAt = addMinutesToLocalDateTime(input.startAt, input.durationMinutes);
  await persistSchedule(input.taskId, {
    plannedDate: input.plannedDate,
    plannedEndDate: undefined,
    startAt: input.startAt,
    endAt,
    allDay: false,
  });
}
```

Return the new actions:

```ts
scheduleTaskAtTime,
moveTimedTask,
resizeTimedTask,
```

- [ ] **Step 4: Run controller test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/useCalendarController.ts src/modules/calendar/controllers/useCalendarController.test.ts
git commit -m "feat: add calendar schedule actions"
```

---

### Task 3: Month Drag Scheduling

**Files:**
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [ ] **Step 1: Add failing drag test**

Append this helper near the top of `src/modules/calendar/components/CalendarPanel.test.tsx`, after the `vi.mock(...)` block, then append the test case inside the existing `describe('CalendarPanel', ...)` block:

```tsx
function createDragData() {
  const values = new Map<string, string>();
  return {
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as DataTransfer;
}

it('drags a task to a month date cell', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
    {id: 1, userId: 1, categoryId: 1, title: '拖拽任务', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
  ]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

  render(
    <CalendarPanel
      categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
      styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
      showToast={vi.fn()}
      initialDate="2026-06-06"
    />,
  );

  const task = await screen.findByText('拖拽任务');
  const target = screen.getByLabelText('2026-06-08');
  const data = createDragData();

  task.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
  target.dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
    plannedDate: '2026-06-08',
    allDay: true,
  }));
});
```

- [ ] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL if date cells are not labelled or drag payload is not stable.

- [ ] **Step 3: Harden month drag payload**

In `MonthCalendarView.tsx`:

1. Add cell aria label:

```tsx
aria-label={day.isoDate}
```

2. Replace drag payload with JSON:

```tsx
onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({taskId: task.id}))}
```

3. Replace drop parser:

```tsx
const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
const payload = raw.startsWith('{') ? JSON.parse(raw) as {taskId: number} : {taskId: Number(raw)};
if (payload.taskId) void onScheduleDate(payload.taskId, day.isoDate);
```

- [ ] **Step 4: Run component test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/components/MonthCalendarView.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: drag tasks onto month dates"
```

---

### Task 4: Week Timeline Drag Scheduling

**Files:**
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [ ] **Step 1: Add failing week drop test**

Append this case inside the existing `describe('CalendarPanel', ...)` block. Reuse the `createDragData()` helper added in Task 3.

```tsx
it('drops an all-day task onto the week timeline', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
    {id: 1, userId: 1, categoryId: 1, title: '安排会议', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
  ]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

  render(
    <CalendarPanel
      categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
      styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
      showToast={vi.fn()}
      initialDate="2026-06-06"
    />,
  );

  const task = await screen.findByText('安排会议');
  const target = screen.getByLabelText('2026-06-06 09:00');
  const data = createDragData();

  task.dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: data}));
  target.dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: data}));

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  }));
});
```

- [ ] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because week slots do not accept drops.

- [ ] **Step 3: Wire controller actions into `CalendarPanel`**

In `CalendarPanel.tsx`, pass actions to `WeekTimelineView`:

```tsx
<WeekTimelineView
  anchorDate={controller.anchorDate}
  tasksByDate={controller.tasksByDate}
  categories={categories}
  focusSessions={controller.focusSessions}
  onScheduleTime={controller.scheduleTaskAtTime}
  onMoveTimedTask={controller.moveTimedTask}
  onResizeTimedTask={controller.resizeTimedTask}
/>
```

- [ ] **Step 4: Add week view props and drop slots**

In `WeekTimelineView.tsx`, update props:

```ts
import type {TaskExecutionSession} from '../../../../shared/domain/entities';

interface WeekTimelineViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
  focusSessions: TaskExecutionSession[];
  onScheduleTime: (input: {taskId: number; date: string; hour: number; minute: number}) => Promise<void>;
  onMoveTimedTask: (input: {taskId: number; date: string; hour: number; minute: number; durationMinutes: number}) => Promise<void>;
  onResizeTimedTask: (input: {taskId: number; plannedDate: string; startAt: string; durationMinutes: number}) => Promise<void>;
}
```

Add drop handler:

```tsx
function readDragPayload(event: React.DragEvent): {taskId: number; durationMinutes?: number} | undefined {
  const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
  if (!raw) return undefined;
  if (raw.startsWith('{')) return JSON.parse(raw) as {taskId: number; durationMinutes?: number};
  return {taskId: Number(raw)};
}
```

In each hour cell:

```tsx
aria-label={`${day.isoDate} ${String(hour).padStart(2, '0')}:00`}
onDragOver={(event) => event.preventDefault()}
onDrop={(event) => {
  const payload = readDragPayload(event);
  if (!payload?.taskId) return;
  if (payload.durationMinutes) {
    void onMoveTimedTask({taskId: payload.taskId, date: day.isoDate, hour, minute: 0, durationMinutes: payload.durationMinutes});
    return;
  }
  void onScheduleTime({taskId: payload.taskId, date: day.isoDate, hour, minute: 0});
}}
```

For timed task drag start:

```tsx
onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({
  taskId: task.id,
  durationMinutes: Math.max(15, Number(task.endAt?.slice(11, 13)) * 60 + Number(task.endAt?.slice(14, 16)) - (Number(task.startAt?.slice(11, 13)) * 60 + Number(task.startAt?.slice(14, 16))),
}))}
```

For all-day task blocks in the top all-day lane, add the same stable payload without `durationMinutes`:

```tsx
draggable
onDragStart={(event) => event.dataTransfer.setData('application/json', JSON.stringify({
  taskId: task.id,
}))}
```

- [ ] **Step 5: Run component test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: drag tasks onto week timeline"
```

---

### Task 5: Duration Resize

**Files:**
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [ ] **Step 1: Add failing resize drag test**

Append this case inside the existing `describe('CalendarPanel', ...)` block:

```tsx
it('drags a timed task resize handle', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
    {
      id: 1,
      userId: 1,
      categoryId: 1,
      title: '时间段任务',
      plannedDate: '2026-06-06',
      allDay: false,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      status: 'TODO',
      createdAt: '',
      updatedAt: '',
    },
  ]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

  render(
    <CalendarPanel
      categories={[{id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}]}
      styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
      showToast={vi.fn()}
      initialDate="2026-06-06"
    />,
  );

  const handle = await screen.findByLabelText('调整时间段任务时长');
  handle.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, clientY: 0}));
  window.dispatchEvent(new MouseEvent('pointermove', {bubbles: true, clientY: 30}));
  window.dispatchEvent(new MouseEvent('pointerup', {bubbles: true, clientY: 30}));

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:30:00.000',
    allDay: false,
  }));
});
```

- [ ] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because resize drag handling is absent.

- [ ] **Step 3: Add pointer resize handle**

In `WeekTimelineView.tsx`, add local resize state near the top of the component:

```tsx
const [resizeState, setResizeState] = useState<{
  taskId: number;
  plannedDate: string;
  startAt: string;
  initialDurationMinutes: number;
  previewDurationMinutes: number;
  startY: number;
} | null>(null);
```

Import React hooks:

```ts
import {useEffect, useState} from 'react';
```

Add an effect:

```tsx
function getResizeDurationMinutes(input: {
  initialDurationMinutes: number;
  startY: number;
  currentY: number;
}): number {
  const deltaMinutes = Math.round((input.currentY - input.startY) / 15) * 15;
  return Math.max(15, input.initialDurationMinutes + deltaMinutes);
}

useEffect(() => {
  if (!resizeState) return undefined;

  const onPointerMove = (event: PointerEvent) => {
    const previewDurationMinutes = getResizeDurationMinutes({
      initialDurationMinutes: resizeState.initialDurationMinutes,
      startY: resizeState.startY,
      currentY: event.clientY,
    });
    setResizeState({...resizeState, previewDurationMinutes});
  };

  const onPointerUp = (event: PointerEvent) => {
    const durationMinutes = getResizeDurationMinutes({
      initialDurationMinutes: resizeState.initialDurationMinutes,
      startY: resizeState.startY,
      currentY: event.clientY,
    });
    void onResizeTimedTask({
      taskId: resizeState.taskId,
      plannedDate: resizeState.plannedDate,
      startAt: resizeState.startAt,
      durationMinutes,
    });
    setResizeState(null);
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, {once: true});

  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
}, [onResizeTimedTask, resizeState]);
```

Inside timed task block render, add the bottom handle:

```tsx
<button
  type="button"
  aria-label={`调整${task.title}时长`}
  className="mt-1 h-2 w-full rounded bg-white/40"
  onPointerDown={(event) => {
    event.stopPropagation();
    if (!task.startAt || !task.endAt) return;
    const startMinutes = Number(task.startAt.slice(11, 13)) * 60 + Number(task.startAt.slice(14, 16));
    const endMinutes = Number(task.endAt.slice(11, 13)) * 60 + Number(task.endAt.slice(14, 16));
    setResizeState({
      taskId: task.id,
      plannedDate: task.plannedDate,
      startAt: task.startAt,
      initialDurationMinutes: Math.max(15, endMinutes - startMinutes),
      previewDurationMinutes: Math.max(15, endMinutes - startMinutes),
      startY: event.clientY,
    });
  }}
/>
```

The `15px -> 15 minutes` mapping is intentionally simple and testable. Do not add freeform pixel-perfect resizing in this pass.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: resize calendar time blocks"
```

---

### Task 6: Focus Records In Calendar

**Files:**
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/CalendarListView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [ ] **Step 1: Add failing focus render test**

Append to `src/modules/calendar/components/CalendarPanel.test.tsx`:

```tsx
it('renders focus records when enabled', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([
    {
      id: 1,
      taskId: 1,
      userId: 1,
      startedAt: '2026-06-06T01:00:00.000Z',
      durationSeconds: 2700,
      status: 'COMPLETED',
      createdAt: '',
      taskTitle: '写方案',
    },
  ]);

  render(
    <CalendarPanel
      categories={[]}
      styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
      showToast={vi.fn()}
      initialDate="2026-06-06"
    />,
  );

  expect(await screen.findByText('专注 45m')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because focus records are not rendered.

- [ ] **Step 3: Render focus records in week view**

In `WeekTimelineView.tsx`, add:

```tsx
import {toIsoDate} from '../../../../shared/lib/date';
import {buildFocusSessionBlock} from '../controllers/weekTimelineLayout';

function focusDate(session: TaskExecutionSession): string {
  return toIsoDate(new Date(session.startedAt));
}

function focusMinutes(session: TaskExecutionSession): number {
  return Math.round((session.durationSeconds ?? 0) / 60);
}
```

In each hour cell, render positioned focus records whose `focusDate(session) === day.isoDate` and whose calculated block starts in that hour:

```tsx
{focusSessions
  .filter((session) => focusDate(session) === day.isoDate)
  .map((session) => ({session, block: buildFocusSessionBlock(session)}))
  .filter(({block}) => Math.floor(block.topMinutes / 60) === hour)
  .map(({session, block}) => (
    <div
      key={`focus-${session.id}`}
      className="mt-1 rounded border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-600"
      style={{
        marginTop: `${Math.max(0, block.topMinutes - hour * 60)}px`,
        minHeight: `${Math.max(24, block.durationMinutes)}px`,
      }}
    >
      专注 {focusMinutes(session)}m
    </div>
  ))}
```

This uses `buildFocusSessionBlock` for timeline placement and the existing shared China-date helper for day grouping, matching reports and focus range behavior.

- [ ] **Step 4: Render focus summaries in list view**

In `CalendarListView.tsx`, update props:

```ts
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {toIsoDate} from '../../../../shared/lib/date';

focusSessions: TaskExecutionSession[];
showFocusSessions: boolean;
```

After task list in each date section:

```tsx
{showFocusSessions && focusSessions
  .filter((session) => toIsoDate(new Date(session.startedAt)) === date)
  .map((session) => (
    <div key={`focus-${session.id}`} className="mt-2 rounded-md bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600">
      专注 {Math.round((session.durationSeconds ?? 0) / 60)}m
    </div>
  ))}
```

In `CalendarPanel.tsx`, pass:

```tsx
focusSessions={controller.focusSessions}
showFocusSessions={controller.settings.showFocusSessions}
```

- [ ] **Step 5: Run focus tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/CalendarListView.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: show focus records in calendar"
```

---

## Interaction Final Verification

- [ ] Run:

```bash
npm test -- src/modules/calendar
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] Manual browser smoke:

```bash
npm run dev
```

Open `http://127.0.0.1:3000` and verify:

- 月视图可以把任务拖到另一个日期。
- 周视图能看到全天栏和 06:00-23:00 时间轴。
- 全天任务拖到 `09:00` 生成 60 分钟时间段。
- 时间段任务拖到其他小时后更新开始/结束时间。
- 时间段任务有“调整时长”控件，点击后时长变化。
- 专注记录开关开启时，周视图或列表视图显示 `专注 Xm`。
- 排期失败时出现错误 toast，页面不会卡死。

Stop the dev server after verification.

## Self-Review Checklist

- 所有排期写操作都走 `useCalendarController`，组件没有直接调用 `calendarApi.updateTaskSchedule`。
- 组件只处理 drag/drop payload 和渲染，不做业务校验。
- 默认时间段是 60 分钟。
- 调整时长不会创建跨天时间段。
- 没有批量操作、推迟、重复任务、节假日、辅助时区、标签、优先级。
- `npm test && npm run lint && npm run build` 全部通过。

## Execution Handoff

Interactions plan complete and saved to `docs/superpowers/plans/2026-06-06-calendar-scheduling-interactions-plan.md`. Execute only after backend and frontend foundation plans pass verification.
