# Calendar Scheduling Phase 2 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐日历二期剩余交互闭环：安排任务栏、多选批量排期/取消、周视图全天栏 drop、任务页嵌入日历。

**Architecture:** 共享排期 mutation 由 calendar controller 暴露，日历视图和任务页只发出明确动作，不直接调用 HTTP 排期 API。安排任务栏自带加载、筛选、选择状态，但批量 mutation 仍走统一 action；拖拽 payload 用专用 MIME，同时保留旧 `application/json` / `text/plain` 兼容。任务页嵌入日历通过 `CalendarSurface` 复用月/周/列表视图，不复制日历业务。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, HTML drag/drop events, Tailwind CSS, lucide-react.

---

## Current State

- Phase 2.1a 后端基础已完成：`plannedDate` 可空、查询过滤、batch schedule/unschedule API 均已存在。
- 一期日历基础已完成：`CalendarPanel`、`useCalendarController`、月视图日期 drop、周视图时间轴 drop/移动/resize 已存在。
- 缺口是二期 UI/交互，不是后端模型。

## File Structure

- Create: `src/modules/calendar/controllers/schedulingDrag.ts` - 专用 MIME、单任务/批量/时间段 payload 读写。
- Create: `src/modules/calendar/controllers/schedulingSelection.ts` - 多选、全选、清空选择纯函数。
- Create: `src/modules/calendar/controllers/useSchedulingSidebarController.ts` - 加载任务池、筛选、选择、批量动作。
- Create: `src/modules/calendar/components/SchedulingSidebar.tsx` - 安排任务栏 UI。
- Create: `src/modules/calendar/components/CalendarSurface.tsx` - 复用月/周/列表视图渲染。
- Create: `src/modules/calendar/components/EmbeddedCalendarPanel.tsx` - 任务页右侧嵌入日历。
- Modify: `src/modules/calendar/api/calendarApi.ts` - 暴露未安排、全天无时间、batch API。
- Modify: `src/modules/calendar/controllers/useCalendarController.ts` - 暴露 `batchScheduleDate` / `batchUnschedule` / mutation success hook。
- Modify: `src/modules/calendar/components/CalendarPanel.tsx` - 装配 `CalendarSurface` 和 `SchedulingSidebar`。
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx` - 读取专用 MIME 和批量 payload。
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx` - 全天栏 drop、时间轴拒绝批量 payload。
- Modify: `src/modules/tasks/components/TasksPanel.tsx` - 显示/隐藏嵌入日历，任务行可拖拽。
- Modify: `src/app/AppShell.tsx` - 给任务页传入 `showToast`、`selectedDate`、刷新回调。
- Test: sibling `*.test.ts` / `*.test.tsx` files beside changed modules.

---

### Task 1: Shared Scheduling Drag And Selection Helpers

**Files:**
- Create: `src/modules/calendar/controllers/schedulingDrag.ts`
- Create: `src/modules/calendar/controllers/schedulingDrag.test.ts`
- Create: `src/modules/calendar/controllers/schedulingSelection.ts`
- Create: `src/modules/calendar/controllers/schedulingSelection.test.ts`

- [ ] **Step 1: Write failing drag helper tests**

Create `src/modules/calendar/controllers/schedulingDrag.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

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
  } as DataTransfer;
}

describe('schedulingDrag', () => {
  it('writes and reads a single task payload through the dedicated MIME', () => {
    const data = dataTransfer();
    writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 3, source: 'sidebar'});

    expect(data.getData(CALENDAR_TASK_DND_MIME)).toContain('"calendar-task"');
    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 3, source: 'sidebar'});
  });

  it('reads legacy json payloads', () => {
    const data = dataTransfer();
    data.setData('application/json', JSON.stringify({taskId: 8}));

    expect(readCalendarDragPayload(data)).toEqual({type: 'calendar-task', taskId: 8, source: 'calendar'});
  });

  it('reads batch and timed payloads', () => {
    const batch = dataTransfer();
    writeCalendarDragPayload(batch, {type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});
    expect(readCalendarDragPayload(batch)).toEqual({type: 'calendar-task-batch', taskIds: [1, 2], source: 'sidebar'});

    const timed = dataTransfer();
    writeCalendarDragPayload(timed, {type: 'calendar-timed-task', taskId: 9, durationMinutes: 90});
    expect(readCalendarDragPayload(timed)).toEqual({type: 'calendar-timed-task', taskId: 9, durationMinutes: 90});
  });
});
```

- [ ] **Step 2: Write failing selection helper tests**

Create `src/modules/calendar/controllers/schedulingSelection.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import {clearSelection, selectAllVisible, toggleTaskSelection} from './schedulingSelection';

describe('schedulingSelection', () => {
  it('toggles one task id without mutating the previous set', () => {
    const current = new Set([1]);
    const next = toggleTaskSelection(current, 2);

    expect([...current]).toEqual([1]);
    expect([...next].sort()).toEqual([1, 2]);
    expect([...toggleTaskSelection(next, 1)]).toEqual([2]);
  });

  it('selects only visible task ids', () => {
    expect([...selectAllVisible([1, 2, 2, 3])]).toEqual([1, 2, 3]);
  });

  it('clears selection', () => {
    expect(clearSelection().size).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/schedulingDrag.test.ts src/modules/calendar/controllers/schedulingSelection.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement helpers**

Create `schedulingDrag.ts` with these exported types/functions:

```ts
export const CALENDAR_TASK_DND_MIME = 'application/x-plantodo-calendar-task';

export type CalendarDragPayload =
  | {type: 'calendar-task'; taskId: number; source: 'sidebar' | 'task-list' | 'calendar'}
  | {type: 'calendar-task-batch'; taskIds: number[]; source: 'sidebar' | 'task-list'}
  | {type: 'calendar-timed-task'; taskId: number; durationMinutes: number};

export function writeCalendarDragPayload(dataTransfer: DataTransfer, payload: CalendarDragPayload): void;
export function readCalendarDragPayload(dataTransfer: DataTransfer): CalendarDragPayload | undefined;
```

Implementation rules:

- Dedicated MIME is first priority.
- `application/json` with `{taskId}` maps to single task from `calendar`.
- `text/plain` numeric value maps to single task from `calendar`.
- Invalid JSON, missing IDs, non-finite IDs, empty batch IDs return `undefined`.

Create `schedulingSelection.ts`:

```ts
export function toggleTaskSelection(current: ReadonlySet<number>, taskId: number): Set<number>;
export function selectAllVisible(taskIds: number[]): Set<number>;
export function clearSelection(): Set<number>;
```

- [ ] **Step 5: Run helper tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/schedulingDrag.test.ts src/modules/calendar/controllers/schedulingSelection.test.ts
```

Expected: PASS.

---

### Task 2: Calendar API And Controller Batch Actions

**Files:**
- Modify: `src/modules/calendar/api/calendarApi.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.test.ts`

- [ ] **Step 1: Write failing API/controller tests**

Append controller tests covering:

```ts
await result.current.batchScheduleDate({taskIds: [1, 2], date: '2026-06-08'});
expect(calendarApi.batchScheduleDate).toHaveBeenCalledWith({taskIds: [1, 2], plannedDate: '2026-06-08'});

await result.current.batchUnschedule({taskIds: [1, 2]});
expect(calendarApi.batchUnschedule).toHaveBeenCalledWith({taskIds: [1, 2]});
```

Also assert both actions call `refreshCalendarData` by expecting `calendarApi.getCalendarTasks` to be called again after mutation, and show an error toast on rejection.

- [ ] **Step 2: Run controller test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: FAIL because calendar API/controller batch methods do not exist.

- [ ] **Step 3: Add calendar API wrappers**

In `calendarApi.ts`, add:

```ts
getUnscheduledTasks(filters?: {categoryId?: number; query?: string}): Promise<Task[]> {
  return tasksApi.getTasks({...filters, scheduled: 'unscheduled'});
},

getAllDayWithoutTimeTasks(filters: CalendarRange & {categoryId?: number; query?: string}): Promise<Task[]> {
  return tasksApi.getTasks({...filters, scheduled: 'all-day-without-time'});
},

batchScheduleDate(input: {taskIds: number[]; plannedDate: string}): Promise<Task[]> {
  return tasksApi.batchScheduleDate(input);
},

batchUnschedule(input: {taskIds: number[]}): Promise<Task[]> {
  return tasksApi.batchUnschedule(input);
},
```

- [ ] **Step 4: Add controller batch actions**

In `useCalendarController.ts`, add optional `onMutationSuccess?: () => Promise<void> | void` arg, call it after successful schedule mutations, and expose:

```ts
async function batchScheduleDate(input: {taskIds: number[]; date: string}) {
  await persistMutation(() => calendarApi.batchScheduleDate({
    taskIds: input.taskIds,
    plannedDate: input.date,
  }), '批量排期失败');
}

async function batchUnschedule(input: {taskIds: number[]}) {
  await persistMutation(() => calendarApi.batchUnschedule({taskIds: input.taskIds}), '批量取消排期失败');
}
```

`persistSchedule` should delegate to a shared `persistMutation` so single and batch actions refresh the calendar and call `onMutationSuccess` consistently.

- [ ] **Step 5: Run controller test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: PASS.

---

### Task 3: Scheduling Sidebar Controller And UI

**Files:**
- Create: `src/modules/calendar/controllers/useSchedulingSidebarController.ts`
- Create: `src/modules/calendar/controllers/useSchedulingSidebarController.test.ts`
- Create: `src/modules/calendar/components/SchedulingSidebar.tsx`
- Create: `src/modules/calendar/components/SchedulingSidebar.test.tsx`

- [ ] **Step 1: Write failing sidebar controller tests**

Cover these behaviors:

- loads `getUnscheduledTasks` and `getAllDayWithoutTimeTasks(range)`;
- applies query/category filters by passing them to both API calls;
- clears selection when range/query/category changes;
- `batchScheduleSelected(date)` calls injected `batchScheduleDate`;
- `batchUnscheduleSelected()` calls injected `batchUnschedule`.

- [ ] **Step 2: Run controller test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/useSchedulingSidebarController.test.ts
```

Expected: FAIL because controller does not exist.

- [ ] **Step 3: Implement sidebar controller**

Expose:

```ts
export function useSchedulingSidebarController(args: {
  range: CalendarRange;
  categories: Category[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  batchScheduleDate: (input: {taskIds: number[]; date: string}) => Promise<void>;
  batchUnschedule: (input: {taskIds: number[]}) => Promise<void>;
}) {
  return {
    tasks,
    loading,
    query,
    setQuery,
    categoryId,
    setCategoryId,
    selectedTaskIds,
    toggleTask,
    selectAllVisible,
    clearSelected,
    batchScheduleSelected,
    batchUnscheduleSelected,
    refresh,
  };
}
```

Use `Promise.all` for the two task-pool requests. Deduplicate by `id`, with unscheduled tasks first. Do not do optimistic updates; refresh after successful mutation.

- [ ] **Step 4: Write failing sidebar component tests**

Cover rendering task rows, search input, category select, checkbox selection, select-all, batch cancel button, and drag payload for single and selected batch rows.

- [ ] **Step 5: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/SchedulingSidebar.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 6: Implement `SchedulingSidebar`**

UI requirements:

- Compact right-side panel, not a marketing card.
- Header includes count and refresh button.
- Search input and category select.
- Task rows show title, category swatch/name, `未安排` or `plannedDate`.
- Checkboxes for multi-select; all rows draggable.
- If multiple tasks are selected and the dragged row is selected, drag batch payload; otherwise drag single payload.
- Batch cancel button disabled when no selection.
- Loading and empty states are explicit.

- [ ] **Step 7: Run sidebar tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/useSchedulingSidebarController.test.ts src/modules/calendar/components/SchedulingSidebar.test.tsx
```

Expected: PASS.

---

### Task 4: Calendar Surface, Sidebar Integration, And Date Drops

**Files:**
- Create: `src/modules/calendar/components/CalendarSurface.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx`
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Add tests:

- Calendar page renders scheduling sidebar and loads unscheduled + all-day-without-time tasks.
- Dragging sidebar single task to month date calls `updateTaskSchedule`.
- Dragging selected sidebar batch to month date calls `batchScheduleDate`.
- Dragging single task to week all-day lane calls `updateTaskSchedule`.
- Dragging selected batch to week all-day lane calls `batchScheduleDate`.
- Dragging batch payload to week time slot shows toast `批量任务只能安排到日期` and does not call mutation.

- [ ] **Step 2: Run integration test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because sidebar, batch drops, and week all-day drops are missing.

- [ ] **Step 3: Extract `CalendarSurface`**

`CalendarSurface` props:

```ts
interface CalendarSurfaceProps {
  controller: ReturnType<typeof useCalendarController>;
  categories: Category[];
  embedded?: boolean;
}
```

It renders `MonthCalendarView`, `WeekTimelineView`, or `CalendarListView`. `CalendarPanel` keeps toolbar/settings/sidebar only.

- [ ] **Step 4: Wire sidebar into `CalendarPanel`**

Use a two-column desktop layout:

```tsx
<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
  <CalendarSurface controller={controller} categories={categories} />
  <SchedulingSidebar ... />
</div>
```

The sidebar receives `controller.range`, `controller.batchScheduleDate`, `controller.batchUnschedule`, and refreshes by calling its own API plus controller mutation success.

- [ ] **Step 5: Update month and week drops**

Use `readCalendarDragPayload` everywhere.

Month/date drop:

- single task => `onScheduleDate(taskId, date)`
- batch => `onBatchScheduleDate(taskIds, date)`
- timed task => `onScheduleDate(taskId, date)` to convert back to all-day date task

Week all-day lane drop:

- same behavior as month date drop.

Week time slot:

- single task => schedule 60m timed task;
- timed task => move with preserved duration;
- batch => call `onRejectBatchTimeDrop`.

- [ ] **Step 6: Run integration test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS.

---

### Task 5: Task Page Embedded Calendar

**Files:**
- Create: `src/modules/calendar/components/EmbeddedCalendarPanel.tsx`
- Create: `src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx`
- Modify: `src/modules/tasks/components/TasksPanel.tsx`
- Modify: `src/modules/tasks/components/TasksPanel.test.tsx`
- Modify: `src/app/AppShell.tsx`

- [ ] **Step 1: Write failing embedded calendar tests**

Cover:

- `EmbeddedCalendarPanel` renders calendar toolbar/surface without scheduling sidebar.
- Dropping a task-list row onto embedded month date schedules it.
- `TasksPanel` has a `显示日历` toggle.
- Task rows write `source: 'task-list'` drag payload.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
```

Expected: FAIL because embedded calendar and task row drag are missing.

- [ ] **Step 3: Implement `EmbeddedCalendarPanel`**

Use `useCalendarController({categories, initialDate, showToast, onMutationSuccess})`, `CalendarToolbar`, and `CalendarSurface`. Do not render scheduling sidebar. Use compact spacing.

- [ ] **Step 4: Update `TasksPanel`**

Add props:

```ts
showToast: (message: string, type?: 'success' | 'error') => void;
selectedDate: string;
refreshAllTasks: () => Promise<Task[]>;
loadTasksForSelectedDate: () => Promise<unknown>;
```

Add local `calendarVisible` toggle. When visible, render a two-column layout with the task list and `EmbeddedCalendarPanel`.

Each task row:

```tsx
draggable
onDragStart={(event) => writeCalendarDragPayload(event.dataTransfer, {
  type: 'calendar-task',
  taskId: task.id,
  source: 'task-list',
})}
```

- [ ] **Step 5: Wire `AppShell`**

Pass `showToast`, `selectedDate`, `refreshAllTasks`, and `loadTasksForSelectedDate` into `TasksPanel`.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
```

Expected: PASS.

---

### Task 6: Regression And Browser Verification

**Files:**
- No new files unless verification exposes defects.

- [ ] **Step 1: Run focused calendar/tasks tests**

Run:

```bash
npm test -- src/modules/calendar src/modules/tasks
```

Expected: PASS.

- [ ] **Step 2: Run full regression**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Run local app and inspect main flows**

Start dev server if not already running:

```bash
npm run dev -- --host 127.0.0.1
```

Verify:

- Calendar page shows sidebar.
- Sidebar tasks can be searched/filtered/selected.
- Month date and week all-day/time drops are visually reachable.
- Tasks page can toggle embedded calendar.
- No obvious overlap at desktop and mobile widths.

