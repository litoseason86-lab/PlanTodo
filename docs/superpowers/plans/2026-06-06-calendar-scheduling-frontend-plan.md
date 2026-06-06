# Calendar Scheduling Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增日历 tab 和 `src/modules/calendar` 前端基础模块，让用户能在月、周、列表三种视图查看任务、按分类/完成状态过滤，并持久化基础显示设置。

**Architecture:** `AppShell` 只新增 tab 装配和 props 传递，不承接任何日历状态。`useCalendarController` 是日历模块唯一的数据和状态入口，调用 `calendarApi` 加载任务/专注记录；布局、设置、分组逻辑放在纯函数中测试。拖拽、调整时长、专注 overlay 的复杂交互留给 interactions plan。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, lucide-react.

---

## Preconditions

先完成 [calendar-scheduling-backend-plan.md](/Users/zerionlito/code/PlanTodo/docs/superpowers/plans/2026-06-06-calendar-scheduling-backend-plan.md)。本计划假设以下 API 已存在：

- `tasksApi.getTasks({dateFrom, dateTo, categoryId})`
- `tasksApi.updateTaskSchedule(taskId, schedule)`
- `focusApi.getSessions({dateFrom, dateTo})`

如果后端 API 尚不存在，不要先写 UI。那是在建没有地基的房子。

## File Structure

- Modify: `src/app/navigation.ts` - 新增 `calendar` tab。
- Modify: `src/app/AppShell.tsx` - 装配 `CalendarPanel`，传入 `categories`、`styleContext`、`showToast`。
- Modify: `src/app/components/AppHeader.tsx` - 为 `calendar` tab 增加图标映射。
- Create: `src/modules/calendar/api/calendarApi.ts` - 对任务和专注 API 暴露日历语义。
- Create: `src/modules/calendar/controllers/calendarSettings.ts` - 默认设置、localStorage、过滤函数。
- Create: `src/modules/calendar/controllers/calendarSettings.test.ts`
- Create: `src/modules/calendar/controllers/calendarLayout.ts` - 月网格、周日期、范围、任务分组、跨天分段。
- Create: `src/modules/calendar/controllers/calendarLayout.test.ts`
- Create: `src/modules/calendar/controllers/useCalendarController.ts` - 视图、锚点日期、设置、数据加载、基础创建/排期动作。
- Create: `src/modules/calendar/controllers/useCalendarController.test.ts`
- Create: `src/modules/calendar/components/CalendarPanel.tsx`
- Create: `src/modules/calendar/components/CalendarToolbar.tsx`
- Create: `src/modules/calendar/components/CalendarSettingsMenu.tsx`
- Create: `src/modules/calendar/components/MonthCalendarView.tsx`
- Create: `src/modules/calendar/components/WeekTimelineView.tsx`
- Create: `src/modules/calendar/components/CalendarListView.tsx`
- Create: `src/modules/calendar/components/CalendarPanel.test.tsx`

---

### Task 1: Calendar API And Settings

**Files:**
- Create: `src/modules/calendar/api/calendarApi.ts`
- Create: `src/modules/calendar/controllers/calendarSettings.ts`
- Create: `src/modules/calendar/controllers/calendarSettings.test.ts`

- [x] **Step 1: Write failing settings tests**

Create `src/modules/calendar/controllers/calendarSettings.test.ts`:

```ts
import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  CALENDAR_SETTINGS_STORAGE_KEY,
  DEFAULT_CALENDAR_SETTINGS,
  filterTasksForCalendar,
  loadCalendarSettings,
  saveCalendarSettings,
} from './calendarSettings';

describe('calendarSettings', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('uses explicit default settings', () => {
    expect(DEFAULT_CALENDAR_SETTINGS).toEqual({
      visibleCategoryIds: [],
      showCompleted: true,
      colorMode: 'category',
      showFocusSessions: true,
    });
  });

  it('filters completed tasks and hidden categories', () => {
    const tasks = [
      {id: 1, categoryId: 1, status: 'DONE'},
      {id: 2, categoryId: 2, status: 'TODO'},
      {id: 3, categoryId: 3, status: 'TODO'},
    ] as never;

    expect(filterTasksForCalendar(tasks, {
      ...DEFAULT_CALENDAR_SETTINGS,
      showCompleted: false,
      visibleCategoryIds: [2],
    })).toEqual([{id: 2, categoryId: 2, status: 'TODO'}]);
  });

  it('persists settings in localStorage', () => {
    saveCalendarSettings({
      visibleCategoryIds: [1, 2],
      showCompleted: false,
      colorMode: 'category',
      showFocusSessions: false,
    });

    expect(localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY)).toContain('"visibleCategoryIds":[1,2]');
    expect(loadCalendarSettings()).toEqual({
      visibleCategoryIds: [1, 2],
      showCompleted: false,
      colorMode: 'category',
      showFocusSessions: false,
    });
  });

  it('falls back to defaults when storage is corrupt', () => {
    localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, '{bad json');
    expect(loadCalendarSettings()).toEqual(DEFAULT_CALENDAR_SETTINGS);
  });
});
```

- [x] **Step 2: Run settings test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarSettings.test.ts
```

Expected: FAIL because module does not exist.

- [x] **Step 3: Implement settings helper**

Create `src/modules/calendar/controllers/calendarSettings.ts`:

```ts
export const CALENDAR_SETTINGS_STORAGE_KEY = 'plantodo.calendar.settings';

export interface CalendarSettings {
  visibleCategoryIds: number[];
  showCompleted: boolean;
  colorMode: 'category';
  showFocusSessions: boolean;
}

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  visibleCategoryIds: [],
  showCompleted: true,
  colorMode: 'category',
  showFocusSessions: true,
};

export function filterTasksForCalendar<T extends {categoryId: number; status: string}>(
  tasks: T[],
  settings: CalendarSettings,
): T[] {
  return tasks.filter((task) => {
    if (!settings.showCompleted && task.status === 'DONE') return false;
    if (settings.visibleCategoryIds.length > 0 && !settings.visibleCategoryIds.includes(task.categoryId)) return false;
    return true;
  });
}

export function loadCalendarSettings(): CalendarSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_CALENDAR_SETTINGS;
  }

  const raw = window.localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CALENDAR_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CalendarSettings>;
    return {
      visibleCategoryIds: Array.isArray(parsed.visibleCategoryIds)
        ? parsed.visibleCategoryIds.filter((id): id is number => typeof id === 'number')
        : [],
      showCompleted: typeof parsed.showCompleted === 'boolean' ? parsed.showCompleted : true,
      colorMode: 'category',
      showFocusSessions: typeof parsed.showFocusSessions === 'boolean' ? parsed.showFocusSessions : true,
    };
  } catch {
    return DEFAULT_CALENDAR_SETTINGS;
  }
}

export function saveCalendarSettings(settings: CalendarSettings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
```

- [x] **Step 4: Implement calendar API wrapper**

Create `src/modules/calendar/api/calendarApi.ts`:

```ts
import type {Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {focusApi} from '../../focus/api/focusApi';
import {tasksApi} from '../../tasks/api/tasksApi';

export interface CalendarRange {
  dateFrom: string;
  dateTo: string;
}

export interface CalendarTaskFilters extends CalendarRange {
  categoryId?: number;
}

export interface TaskSchedulePayload {
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export const calendarApi = {
  getCalendarTasks(filters: CalendarTaskFilters): Promise<Task[]> {
    return tasksApi.getTasks(filters);
  },

  createCalendarTask(input: {title: string; categoryId: number; plannedDate: string; allDay: true}): Promise<Task> {
    return tasksApi.createTask(input);
  },

  updateTaskSchedule(taskId: number, schedule: TaskSchedulePayload): Promise<Task> {
    return tasksApi.updateTaskSchedule(taskId, schedule);
  },

  getFocusSessions(range: CalendarRange): Promise<TaskExecutionSession[]> {
    return focusApi.getSessions(range);
  },
};
```

- [x] **Step 5: Run settings test and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarSettings.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/modules/calendar/api/calendarApi.ts src/modules/calendar/controllers/calendarSettings.ts src/modules/calendar/controllers/calendarSettings.test.ts
git commit -m "feat: add calendar api and settings"
```

---

### Task 2: Calendar Layout Helpers

**Files:**
- Create: `src/modules/calendar/controllers/calendarLayout.ts`
- Create: `src/modules/calendar/controllers/calendarLayout.test.ts`

- [x] **Step 1: Write failing layout tests**

Create `src/modules/calendar/controllers/calendarLayout.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import type {Task} from '../../../../shared/domain/entities';
import {
  buildMonthGrid,
  buildWeekDays,
  getCalendarRange,
  groupTasksByDate,
  segmentAllDayTask,
} from './calendarLayout';

const baseTask: Task = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  allDay: true,
  status: 'TODO',
  createdAt: '',
  updatedAt: '',
};

describe('calendarLayout', () => {
  it('builds a Monday-first month grid', () => {
    const grid = buildMonthGrid('2026-06-06');
    expect(grid[0]).toEqual({isoDate: '2026-06-01', isCurrentMonth: true});
    expect(grid.at(-1)?.isoDate).toBe('2026-07-05');
  });

  it('builds week days and ranges', () => {
    expect(buildWeekDays('2026-06-06').map((day) => day.isoDate)).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(getCalendarRange('week', '2026-06-06')).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});
    expect(getCalendarRange('list', '2026-06-06')).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});
  });

  it('groups date, cross-day, and timed tasks by visible date', () => {
    const grouped = groupTasksByDate([
      baseTask,
      {...baseTask, id: 2, title: '跨天', plannedDate: '2026-06-05', plannedEndDate: '2026-06-07'},
      {...baseTask, id: 3, title: '会议', allDay: false, startAt: '2026-06-06T09:00:00.000', endAt: '2026-06-06T10:00:00.000'},
    ], '2026-06-06', '2026-06-06');

    expect(grouped['2026-06-06'].map((task) => task.title)).toEqual(['写方案', '跨天', '会议']);
  });

  it('segments all-day cross-day tasks within a visible range', () => {
    expect(segmentAllDayTask({
      ...baseTask,
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-09',
    }, '2026-06-06', '2026-06-08')).toEqual({
      taskId: 1,
      startsOn: '2026-06-06',
      endsOn: '2026-06-08',
      continuesBefore: true,
      continuesAfter: true,
    });
  });
});
```

- [x] **Step 2: Run layout tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarLayout.test.ts
```

Expected: FAIL because layout helpers do not exist.

- [x] **Step 3: Implement layout helpers**

Create `src/modules/calendar/controllers/calendarLayout.ts`:

```ts
import type {Task} from '../../../../shared/domain/entities';
import {addIsoDateDays, getWeekStart} from '../../../../shared/lib/date';
import {enumerateDateRange, taskIntersectsDateRange, toCanonicalTask} from '../../../../shared/lib/schedule';

export type CalendarView = 'month' | 'week' | 'list';

export interface CalendarDay {
  isoDate: string;
  isCurrentMonth: boolean;
}

export interface AllDaySegment {
  taskId: number;
  startsOn: string;
  endsOn: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function firstDayOfMonth(anchorDate: string): string {
  return `${anchorDate.slice(0, 7)}-01`;
}

function lastDayOfMonth(anchorDate: string): string {
  const [year, month] = anchorDate.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

export function buildWeekDays(anchorDate: string): CalendarDay[] {
  const start = getWeekStart(anchorDate);
  return Array.from({length: 7}, (_, index) => ({
    isoDate: addIsoDateDays(start, index),
    isCurrentMonth: true,
  }));
}

export function buildMonthGrid(anchorDate: string): CalendarDay[] {
  const first = firstDayOfMonth(anchorDate);
  const last = lastDayOfMonth(anchorDate);
  const gridStart = getWeekStart(first);
  const month = monthOf(anchorDate);
  const days: CalendarDay[] = [];

  for (let current = gridStart; days.length === 0 || days.length % 7 !== 0 || current <= last; current = addIsoDateDays(current, 1)) {
    days.push({isoDate: current, isCurrentMonth: monthOf(current) === month});
  }

  return days;
}

export function getCalendarRange(view: CalendarView, anchorDate: string): {dateFrom: string; dateTo: string} {
  if (view === 'month') {
    return {dateFrom: firstDayOfMonth(anchorDate), dateTo: lastDayOfMonth(anchorDate)};
  }

  const week = buildWeekDays(anchorDate);
  return {dateFrom: week[0].isoDate, dateTo: week[6].isoDate};
}

export function groupTasksByDate(tasks: Task[], dateFrom: string, dateTo: string): Record<string, Task[]> {
  const groups = Object.fromEntries(enumerateDateRange(dateFrom, dateTo).map((date) => [date, [] as Task[]]));

  for (const rawTask of tasks) {
    const task = toCanonicalTask(rawTask);
    if (!taskIntersectsDateRange(task, dateFrom, dateTo)) {
      continue;
    }

    const startDate = task.startAt ? task.startAt.slice(0, 10) : task.plannedDate;
    const endDate = task.endAt ? task.endAt.slice(0, 10) : task.plannedEndDate ?? task.plannedDate;
    const visibleStart = startDate < dateFrom ? dateFrom : startDate;
    const visibleEnd = endDate > dateTo ? dateTo : endDate;

    for (const date of enumerateDateRange(visibleStart, visibleEnd)) {
      groups[date]?.push(task);
    }
  }

  return groups;
}

export function segmentAllDayTask(task: Task, dateFrom: string, dateTo: string): AllDaySegment {
  const canonical = toCanonicalTask(task);
  const startsOn = canonical.plannedDate < dateFrom ? dateFrom : canonical.plannedDate;
  const realEnd = canonical.plannedEndDate ?? canonical.plannedDate;
  const endsOn = realEnd > dateTo ? dateTo : realEnd;

  return {
    taskId: canonical.id,
    startsOn,
    endsOn,
    continuesBefore: canonical.plannedDate < dateFrom,
    continuesAfter: realEnd > dateTo,
  };
}
```

- [x] **Step 4: Run layout tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarLayout.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/calendarLayout.ts src/modules/calendar/controllers/calendarLayout.test.ts
git commit -m "feat: add calendar layout helpers"
```

---

### Task 3: Calendar Controller

**Files:**
- Create: `src/modules/calendar/controllers/useCalendarController.ts`
- Create: `src/modules/calendar/controllers/useCalendarController.test.ts`

- [x] **Step 1: Write failing controller tests**

Create `src/modules/calendar/controllers/useCalendarController.test.ts`:

```ts
import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {useCalendarController} from './useCalendarController';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    createCalendarTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
  },
}));

describe('useCalendarController', () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('defaults to week view and recalculates range when view changes', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    expect(result.current.view).toBe('week');
    expect(result.current.range).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-07'});

    act(() => result.current.setView('month'));

    expect(result.current.range).toEqual({dateFrom: '2026-06-01', dateTo: '2026-06-30'});
    await waitFor(() => expect(calendarApi.getCalendarTasks).toHaveBeenCalled());
  });

  it('updates an all-day task schedule then refreshes', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.scheduleTaskForDate(1, '2026-06-08');
    });

    expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, {
      plannedDate: '2026-06-08',
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });

  it('creates an all-day task from a date cell', async () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
    vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

    const {result} = renderHook(() => useCalendarController({
      categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
      initialDate: '2026-06-06',
      showToast: vi.fn(),
    }));

    await act(async () => {
      await result.current.createAllDayTask('2026-06-08', '新任务');
    });

    expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
      title: '新任务',
      categoryId: 8,
      plannedDate: '2026-06-08',
      allDay: true,
    });
  });
});
```

- [x] **Step 2: Run controller tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: FAIL because controller does not exist.

- [x] **Step 3: Implement controller**

Create `src/modules/calendar/controllers/useCalendarController.ts`:

```ts
import {useCallback, useEffect, useMemo, useState} from 'react';

import type {Category, Task, TaskExecutionSession} from '../../../../shared/domain/entities';
import {toIsoDate} from '../../../../shared/lib/date';
import {calendarApi} from '../api/calendarApi';
import {getCalendarRange, groupTasksByDate, type CalendarView} from './calendarLayout';
import {
  filterTasksForCalendar,
  loadCalendarSettings,
  saveCalendarSettings,
  type CalendarSettings,
} from './calendarSettings';

interface UseCalendarControllerArgs {
  categories: Category[];
  initialDate?: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function useCalendarController({categories, initialDate, showToast}: UseCalendarControllerArgs) {
  const [view, setView] = useState<CalendarView>('week');
  const [anchorDate, setAnchorDate] = useState(() => initialDate ?? toIsoDate(new Date()));
  const [settings, setSettingsState] = useState<CalendarSettings>(() => loadCalendarSettings());
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [focusSessions, setFocusSessions] = useState<TaskExecutionSession[]>([]);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => getCalendarRange(view, anchorDate), [view, anchorDate]);
  const tasks = useMemo(() => filterTasksForCalendar(rawTasks, settings), [rawTasks, settings]);
  const tasksByDate = useMemo(() => groupTasksByDate(tasks, range.dateFrom, range.dateTo), [tasks, range.dateFrom, range.dateTo]);

  const setSettings = useCallback((next: CalendarSettings) => {
    setSettingsState(next);
    saveCalendarSettings(next);
  }, []);

  const refreshCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const categoryId = settings.visibleCategoryIds.length === 1 ? settings.visibleCategoryIds[0] : undefined;
      const [taskData, sessionData] = await Promise.all([
        calendarApi.getCalendarTasks({...range, categoryId}),
        settings.showFocusSessions ? calendarApi.getFocusSessions(range) : Promise.resolve([]),
      ]);
      setRawTasks(taskData);
      setFocusSessions(sessionData);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '日历数据加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, settings.showFocusSessions, settings.visibleCategoryIds, showToast]);

  useEffect(() => {
    void refreshCalendarData();
  }, [refreshCalendarData]);

  async function scheduleTaskForDate(taskId: number, plannedDate: string) {
    await calendarApi.updateTaskSchedule(taskId, {
      plannedDate,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
    await refreshCalendarData();
  }

  async function createAllDayTask(plannedDate: string, title = '新任务') {
    const categoryId = categories[0]?.id;
    if (!categoryId) {
      showToast('请先创建分类', 'error');
      return;
    }

    await calendarApi.createCalendarTask({
      title,
      categoryId,
      plannedDate,
      allDay: true,
    });
    await refreshCalendarData();
  }

  return {
    view,
    setView,
    anchorDate,
    setAnchorDate,
    range,
    settings,
    setSettings,
    categories,
    rawTasks,
    tasks,
    tasksByDate,
    focusSessions,
    loading,
    refreshCalendarData,
    createAllDayTask,
    scheduleTaskForDate,
  };
}
```

- [x] **Step 4: Run controller tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/useCalendarController.ts src/modules/calendar/controllers/useCalendarController.test.ts
git commit -m "feat: add calendar controller"
```

---

### Task 4: Calendar Shell And Navigation

**Files:**
- Modify: `src/app/navigation.ts`
- Modify: `src/app/components/AppHeader.tsx`
- Modify: `src/app/AppShell.tsx`
- Create: `src/modules/calendar/components/CalendarPanel.tsx`
- Create: `src/modules/calendar/components/CalendarToolbar.tsx`
- Create: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [x] **Step 1: Write failing shell test**

Create `src/modules/calendar/components/CalendarPanel.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {calendarApi} from '../api/calendarApi';
import {CalendarPanel} from './CalendarPanel';

vi.mock('../api/calendarApi', () => ({
  calendarApi: {
    getCalendarTasks: vi.fn(),
    getFocusSessions: vi.fn(),
    createCalendarTask: vi.fn(),
    updateTaskSchedule: vi.fn(),
  },
}));

describe('CalendarPanel', () => {
  it('renders calendar shell and view switcher', () => {
    vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
    vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

    render(
      <CalendarPanel
        categories={[]}
        styleContext={{primary: '#fb7185', primaryLight: '#ffe4e6', secondary: '#fda4af'}}
        showToast={vi.fn()}
        initialDate="2026-06-06"
      />,
    );

    expect(screen.getByRole('heading', {name: '日历'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '月'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '周'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '列表'})).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run shell test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because components do not exist.

- [x] **Step 3: Implement toolbar**

Create `src/modules/calendar/components/CalendarToolbar.tsx`:

```tsx
import {ChevronLeft, ChevronRight, Settings} from 'lucide-react';

import {addIsoDateDays} from '../../../../shared/lib/date';
import type {CalendarView} from '../controllers/calendarLayout';

interface CalendarToolbarProps {
  view: CalendarView;
  anchorDate: string;
  setView: (view: CalendarView) => void;
  setAnchorDate: (date: string) => void;
  onOpenSettings: () => void;
}

export function CalendarToolbar({view, anchorDate, setView, setAnchorDate, onOpenSettings}: CalendarToolbarProps) {
  const step = view === 'month' ? 28 : 7;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">日历</h2>
        <p className="text-xs font-semibold text-slate-400">{anchorDate}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="上一段" onClick={() => setAnchorDate(addIsoDateDays(anchorDate, -step))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" aria-label="下一段" onClick={() => setAnchorDate(addIsoDateDays(anchorDate, step))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(['month', 'week', 'list'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === item ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
            >
              {item === 'month' ? '月' : item === 'week' ? '周' : '列表'}
            </button>
          ))}
        </div>
        <button type="button" aria-label="显示设置" onClick={onOpenSettings} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-600">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Implement panel shell**

Create `src/modules/calendar/components/CalendarPanel.tsx`:

```tsx
import {useState} from 'react';

import type {Category} from '../../../../shared/domain/entities';
import {useCalendarController} from '../controllers/useCalendarController';
import {CalendarToolbar} from './CalendarToolbar';

interface CalendarPanelProps {
  categories: Category[];
  styleContext: {primary: string; primaryLight: string; secondary: string};
  showToast: (message: string, type?: 'success' | 'error') => void;
  initialDate?: string;
}

export function CalendarPanel({categories, styleContext, showToast, initialDate}: CalendarPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const controller = useCalendarController({categories, initialDate, showToast});

  return (
    <section id="calendar_view" className="space-y-4">
      <CalendarToolbar
        view={controller.view}
        anchorDate={controller.anchorDate}
        setView={controller.setView}
        setAnchorDate={controller.setAnchorDate}
        onOpenSettings={() => setSettingsOpen((open) => !open)}
      />
      {settingsOpen && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
          显示设置
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-4" style={{borderColor: styleContext.primaryLight}}>
        <p className="text-sm font-bold text-slate-700">日历数据加载中...</p>
      </div>
    </section>
  );
}
```

- [x] **Step 5: Wire navigation**

In `src/app/navigation.ts`, add tab before `daily`:

```ts
{key: 'calendar', label: '日历'},
```

In `src/app/components/AppHeader.tsx`:

1. Add `CalendarDays` import from `lucide-react`.
2. Add icon map entry:

```ts
calendar: CalendarDays,
```

In `src/app/AppShell.tsx`:

1. Import:

```ts
import {CalendarPanel} from '../modules/calendar/components/CalendarPanel';
```

2. Add render branch before daily:

```tsx
{activeTab === 'calendar' && (
  <CalendarPanel
    styleContext={{primary: styleContext.primary, primaryLight: styleContext.primaryLight, secondary: styleContext.secondary}}
    categories={categories}
    showToast={showToast}
  />
)}
```

- [x] **Step 6: Run shell tests and typecheck**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
npm run lint
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/app/navigation.ts src/app/components/AppHeader.tsx src/app/AppShell.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarToolbar.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: add calendar tab shell"
```

---

### Task 5: Month, Week, And List Read Views

**Files:**
- Create: `src/modules/calendar/components/MonthCalendarView.tsx`
- Create: `src/modules/calendar/components/WeekTimelineView.tsx`
- Create: `src/modules/calendar/components/CalendarListView.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [x] **Step 1: Add failing render test**

Append this case inside the existing `describe('CalendarPanel', ...)` block. The file already imports and mocks `calendarApi`; do not add a second import or `vi.mock`.

```tsx
it('renders month tasks', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
    {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
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

  await screen.findByText('写方案');
});
```

- [x] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because read views are not implemented.

- [x] **Step 3: Implement month view**

Create `src/modules/calendar/components/MonthCalendarView.tsx`:

```tsx
import type {Category, Task} from '../../../../shared/domain/entities';
import {buildMonthGrid, segmentAllDayTask} from '../controllers/calendarLayout';

interface MonthCalendarViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
  onCreateDateTask: (date: string) => Promise<void>;
  onScheduleDate: (taskId: number, date: string) => Promise<void>;
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

export function MonthCalendarView({anchorDate, tasksByDate, categories, onCreateDateTask, onScheduleDate}: MonthCalendarViewProps) {
  const days = buildMonthGrid(anchorDate);
  const visibleStart = days[0].isoDate;
  const visibleEnd = days[days.length - 1].isoDate;

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {days.map((day) => (
        <button
          key={day.isoDate}
          type="button"
          onClick={() => void onCreateDateTask(day.isoDate)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const taskId = Number(event.dataTransfer.getData('text/plain'));
            if (taskId) void onScheduleDate(taskId, day.isoDate);
          }}
          className={`min-h-28 border-b border-r border-slate-100 p-2 text-left align-top ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'}`}
        >
          <span className="text-xs font-bold">{day.isoDate.slice(8)}</span>
          <div className="mt-2 space-y-1">
            {(tasksByDate[day.isoDate] ?? []).slice(0, 4).map((task) => (
              (() => {
                const segment = task.allDay ? segmentAllDayTask(task, visibleStart, visibleEnd) : undefined;
                const startsHere = !segment || segment.startsOn === day.isoDate;
                const endsHere = !segment || segment.endsOn === day.isoDate;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', String(task.id))}
                    className={`truncate px-2 py-1 text-[11px] font-bold text-white ${startsHere ? 'rounded-l' : 'rounded-l-none'} ${endsHere ? 'rounded-r' : 'rounded-r-none'}`}
                    style={{backgroundColor: categoryColor(categories, task.categoryId)}}
                    title={task.title}
                  >
                    {!startsHere ? '↤ ' : ''}
                    {task.title}
                    {!endsHere ? ' ↦' : ''}
                  </div>
                );
              })()
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [x] **Step 4: Implement week read view**

Create `src/modules/calendar/components/WeekTimelineView.tsx`:

```tsx
import type {Category, Task} from '../../../../shared/domain/entities';
import {buildWeekDays} from '../controllers/calendarLayout';

const HOURS = Array.from({length: 18}, (_, index) => index + 6);

interface WeekTimelineViewProps {
  anchorDate: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

export function WeekTimelineView({anchorDate, tasksByDate, categories}: WeekTimelineViewProps) {
  const days = buildWeekDays(anchorDate);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200">
        <div className="p-2 text-xs font-bold text-slate-400">全天</div>
        {days.map((day) => (
          <div key={day.isoDate} className="min-h-20 border-l border-slate-100 p-2">
            <div className="mb-2 text-xs font-bold text-slate-500">{day.isoDate.slice(5)}</div>
            {(tasksByDate[day.isoDate] ?? []).filter((task) => task.allDay).map((task) => (
              <div key={task.id} className="mb-1 truncate rounded px-2 py-1 text-[11px] font-bold text-white" style={{backgroundColor: categoryColor(categories, task.categoryId)}}>
                {task.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      {HOURS.map((hour) => (
        <div key={hour} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-100">
          <div className="p-2 text-xs font-semibold text-slate-400">{String(hour).padStart(2, '0')}:00</div>
          {days.map((day) => (
            <div key={`${day.isoDate}-${hour}`} className="min-h-12 border-l border-slate-100 p-1">
              {(tasksByDate[day.isoDate] ?? [])
                .filter((task) => !task.allDay && task.startAt?.slice(11, 13) === String(hour).padStart(2, '0'))
                .map((task) => (
                  <div key={task.id} className="truncate rounded px-2 py-1 text-[11px] font-bold text-white" style={{backgroundColor: categoryColor(categories, task.categoryId)}}>
                    {task.startAt?.slice(11, 16)} {task.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 5: Implement list view**

Create `src/modules/calendar/components/CalendarListView.tsx`:

```tsx
import type {Category, Task} from '../../../../shared/domain/entities';
import {enumerateDateRange} from '../../../../shared/lib/schedule';

interface CalendarListViewProps {
  dateFrom: string;
  dateTo: string;
  tasksByDate: Record<string, Task[]>;
  categories: Category[];
}

function categoryColor(categories: Category[], categoryId: number): string {
  return categories.find((category) => category.id === categoryId)?.color ?? '#64748b';
}

export function CalendarListView({dateFrom, dateTo, tasksByDate, categories}: CalendarListViewProps) {
  return (
    <div className="space-y-3">
      {enumerateDateRange(dateFrom, dateTo).map((date) => (
        <section key={date} className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-extrabold text-slate-500">{date}</h3>
          <div className="space-y-2">
            {(tasksByDate[date] ?? []).map((task) => (
              <div key={`${date}-${task.id}`} className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: categoryColor(categories, task.categoryId)}} />
                <span className="text-xs font-bold text-slate-700">{task.title}</span>
                {!task.allDay && task.startAt && task.endAt && (
                  <span className="ml-auto text-[11px] font-semibold text-slate-400">{task.startAt.slice(11, 16)}-{task.endAt.slice(11, 16)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [x] **Step 6: Wire views into panel**

In `src/modules/calendar/components/CalendarPanel.tsx`, import:

```ts
import {CalendarListView} from './CalendarListView';
import {MonthCalendarView} from './MonthCalendarView';
import {WeekTimelineView} from './WeekTimelineView';
```

Replace placeholder content with:

```tsx
{controller.view === 'month' && (
  <MonthCalendarView
    anchorDate={controller.anchorDate}
    tasksByDate={controller.tasksByDate}
    categories={categories}
    onCreateDateTask={controller.createAllDayTask}
    onScheduleDate={controller.scheduleTaskForDate}
  />
)}
{controller.view === 'week' && (
  <WeekTimelineView
    anchorDate={controller.anchorDate}
    tasksByDate={controller.tasksByDate}
    categories={categories}
  />
)}
{controller.view === 'list' && (
  <CalendarListView
    dateFrom={controller.range.dateFrom}
    dateTo={controller.range.dateTo}
    tasksByDate={controller.tasksByDate}
    categories={categories}
  />
)}
```

- [x] **Step 7: Run component tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/modules/calendar/components/MonthCalendarView.tsx src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/CalendarListView.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: render calendar read views"
```

---

### Task 6: Display Settings Menu

**Files:**
- Create: `src/modules/calendar/components/CalendarSettingsMenu.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`

- [x] **Step 1: Add failing settings interaction test**

Update the existing top import in `src/modules/calendar/components/CalendarPanel.test.tsx`:

```tsx
import {fireEvent, render, screen} from '@testing-library/react';
```

Then append this case inside the existing `describe('CalendarPanel', ...)` block:

```tsx
it('hides completed tasks from settings', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([
    {id: 1, userId: 1, categoryId: 1, title: '完成任务', plannedDate: '2026-06-06', allDay: true, status: 'DONE', createdAt: '', updatedAt: ''},
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

  expect(await screen.findByText('完成任务')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('显示设置'));
  fireEvent.click(screen.getByLabelText('显示已完成'));
  expect(screen.queryByText('完成任务')).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run component test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: FAIL because real settings menu is absent.

- [x] **Step 3: Implement settings menu**

Create `src/modules/calendar/components/CalendarSettingsMenu.tsx`:

```tsx
import type {Category} from '../../../../shared/domain/entities';
import type {CalendarSettings} from '../controllers/calendarSettings';

interface CalendarSettingsMenuProps {
  categories: Category[];
  settings: CalendarSettings;
  setSettings: (settings: CalendarSettings) => void;
}

export function CalendarSettingsMenu({categories, settings, setSettings}: CalendarSettingsMenuProps) {
  const toggleCategory = (categoryId: number) => {
    const allCategoryIds = categories.map((category) => category.id);
    const currentVisibleIds = settings.visibleCategoryIds.length === 0 ? allCategoryIds : settings.visibleCategoryIds;
    const visibleCategoryIds = currentVisibleIds.includes(categoryId)
      ? currentVisibleIds.filter((id) => id !== categoryId)
      : [...currentVisibleIds, categoryId];
    setSettings({...settings, visibleCategoryIds});
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 text-xs font-bold text-slate-600 sm:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showCompleted}
            onChange={(event) => setSettings({...settings, showCompleted: event.target.checked})}
          />
          显示已完成
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showFocusSessions}
            onChange={(event) => setSettings({...settings, showFocusSessions: event.target.checked})}
          />
          显示专注记录
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-extrabold text-slate-500">分类显示范围</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={settings.visibleCategoryIds.length === 0 || settings.visibleCategoryIds.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: category.color}} />
              {category.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Wire settings menu into panel**

In `CalendarPanel.tsx`, import and replace placeholder:

```tsx
import {CalendarSettingsMenu} from './CalendarSettingsMenu';
```

```tsx
{settingsOpen && (
  <CalendarSettingsMenu
    categories={categories}
    settings={controller.settings}
    setSettings={controller.setSettings}
  />
)}
```

- [x] **Step 5: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx src/modules/calendar/controllers/calendarSettings.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/modules/calendar/components/CalendarSettingsMenu.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarPanel.test.tsx
git commit -m "feat: add calendar display settings"
```

---

## Frontend Foundation Verification

- [x] Run:

```bash
npm test -- src/modules/calendar
npm run lint
npm run build
```

Expected: all commands exit 0.

- [x] Browser smoke test:

```bash
npm run dev
```

Open `http://127.0.0.1:3000` and verify:

- Header has “日历” tab.
- Month/week/list buttons switch visible layout.
- Existing tasks appear in calendar.
- Clicking a month date creates a default all-day task in the first category.
- “显示已完成” can hide completed tasks.
- Category color dots/task blocks match category color.

Stop the dev server after verification.

## Self-Review Checklist

- `AppShell` only mounts `CalendarPanel`; it does not own calendar view, range, tasks, or settings state.
- `calendarApi` wraps existing task/focus APIs and exposes calendar language.
- Settings persist in `localStorage`; no backend user settings table was added.
- Month, week, and list views are read-capable before drag/resize complexity begins.
- Month date click creates an all-day task through the existing task API.
- No batch operation, repeat task, holiday, lunar calendar, tag, priority, or external calendar code was introduced.

## Execution Handoff

Frontend foundation plan complete. Execute this after backend plan and before interactions plan. The interactions plan assumes these files and controller actions exist.
