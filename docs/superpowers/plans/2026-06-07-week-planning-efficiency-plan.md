# Week Planning Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved week-view planning efficiency improvements: quick time-block creation, multi-day all-day creation, resize hardening, timeline density, scheduling-sidebar toggle, and safe full/embedded calendar capability boundaries.

**Architecture:** Keep business mutation behind `calendarApi` and `useCalendarController`; components emit intent and never call `tasksApi` directly. Put date/time math, density mapping, event thresholds, and all-day segment layout into pure controller helpers so `WeekTimelineView` remains a view coordinator instead of a logic sink. Reuse existing `CalendarSettings` localStorage for density and keep scheduling-sidebar visibility as `CalendarPanel` local state only.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, Tailwind CSS, existing Express task APIs.

---

## File Structure

- Create: `src/modules/calendar/controllers/weekTimelineInteraction.ts` - quick-create, resize, density, and all-day range pure functions.
- Create: `src/modules/calendar/controllers/weekTimelineInteraction.test.ts` - pure behavior tests for time/date math and density.
- Create: `src/modules/calendar/components/CalendarQuickCreatePopover.tsx` - shared inline creation form for timed and all-day drafts.
- Create: `src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx` - popover form behavior tests.
- Modify: `src/modules/calendar/api/calendarApi.ts` - widen `createCalendarTask` input to full task creation schedule payload.
- Modify: `src/modules/calendar/controllers/calendarSettings.ts` - add `weekTimelineDensity` to existing settings.
- Modify: `src/modules/calendar/controllers/calendarSettings.test.ts` - test density defaults, persistence, and corrupt/partial settings.
- Modify: `src/modules/calendar/controllers/useCalendarController.ts` - own quick-create draft state, submit logic, density setter, all-day/timed create actions.
- Modify: `src/modules/calendar/controllers/useCalendarController.test.ts` - controller quick-create and density tests.
- Modify: `src/modules/calendar/controllers/useTaskSchedulingActions.ts` - clamp resize/move end times before calling local datetime addition.
- Modify: `src/modules/calendar/controllers/useTaskSchedulingActions.test.ts` - resize/move clamp tests.
- Modify: `src/modules/calendar/controllers/calendarLayout.ts` - add week all-day segment helper or reusable segment wrapper.
- Modify: `src/modules/calendar/controllers/calendarLayout.test.ts` - week all-day segment tests.
- Modify: `src/modules/calendar/controllers/weekTimelineLayout.ts` - replace fixed-pixel assumptions with `hourHeight`-aware helpers where needed.
- Modify: `src/modules/calendar/controllers/weekTimelineLayout.test.ts` - density-aware drop/resize regression tests.
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx` - wire quick create, density heights, resize gate, continuous all-day rendering.
- Modify: `src/modules/calendar/components/WeekTimelineView.test.tsx` - view-level quick-create, event priority, all-day segment, and resize-handle tests.
- Modify: `src/modules/calendar/components/CalendarToolbar.tsx` - capability props for scheduling sidebar and density controls.
- Modify: `src/modules/calendar/components/CalendarPanel.tsx` - scheduling-sidebar open/close state and quick-create popover rendering.
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx` - integration tests for quick create, sidebar toggle, density, refresh.
- Modify: `src/modules/calendar/components/CalendarSurface.tsx` - pass full/embedded capabilities to week view.
- Modify: `src/modules/calendar/components/EmbeddedCalendarPanel.tsx` - keep quick-create/sidebar/density controls disabled.
- Modify: `src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx` - assert full-calendar-only controls stay hidden.

---

### Task 1: Pure Timeline Interaction And Density Rules

**Files:**
- Create: `src/modules/calendar/controllers/weekTimelineInteraction.ts`
- Create: `src/modules/calendar/controllers/weekTimelineInteraction.test.ts`

- [ ] **Step 1: Write failing interaction tests**

Create `src/modules/calendar/controllers/weekTimelineInteraction.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import {
  WEEK_TIMELINE_DENSITY_HEIGHTS,
  buildAllDayQuickCreateDraft,
  buildTimedQuickCreateDraftFromDrag,
  buildTimedQuickCreateDraftFromPoint,
  canResizeTimedTask,
  getResizeDurationMinutes,
  hourHeightForDensity,
} from './weekTimelineInteraction';

describe('weekTimelineInteraction', () => {
  it('maps density to hour heights', () => {
    expect(WEEK_TIMELINE_DENSITY_HEIGHTS).toEqual({
      compact: 48,
      standard: 64,
      comfortable: 88,
    });
    expect(hourHeightForDensity('compact')).toBe(48);
    expect(hourHeightForDensity('standard')).toBe(64);
    expect(hourHeightForDensity('comfortable')).toBe(88);
  });

  it('creates a default 60 minute timed draft from a point', () => {
    expect(buildTimedQuickCreateDraftFromPoint({
      date: '2026-06-06',
      hour: 9,
      clientY: 132,
      rectTop: 100,
      hourHeight: 64,
      anchor: {x: 20, y: 132},
    })).toEqual({
      kind: 'timed',
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:30:00.000',
      endAt: '2026-06-06T10:30:00.000',
      anchor: {x: 20, y: 132},
    });
  });

  it('clamps late point creation to 23:44-23:59', () => {
    expect(buildTimedQuickCreateDraftFromPoint({
      date: '2026-06-06',
      hour: 23,
      clientY: 163,
      rectTop: 100,
      hourHeight: 64,
      anchor: {x: 20, y: 163},
    })).toMatchObject({
      startAt: '2026-06-06T23:44:00.000',
      endAt: '2026-06-06T23:59:00.000',
    });
  });

  it('creates an ascending timed draft from downward drag', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 9,
      startClientY: 100,
      endHour: 11,
      endClientY: 32,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T11:30:00.000',
    });
  });

  it('creates an ascending timed draft from upward drag', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 12,
      startClientY: 100,
      endHour: 10,
      endClientY: 32,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T10:30:00.000',
      endAt: '2026-06-06T12:00:00.000',
    });
  });

  it('keeps dragged timed drafts at least 15 minutes', () => {
    expect(buildTimedQuickCreateDraftFromDrag({
      date: '2026-06-06',
      startHour: 9,
      startClientY: 100,
      endHour: 9,
      endClientY: 103,
      startRectTop: 100,
      endRectTop: 100,
      hourHeight: 64,
      anchor: {x: 40, y: 100},
    })).toMatchObject({
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T09:15:00.000',
    });
  });

  it('builds all-day drafts in ascending date order', () => {
    expect(buildAllDayQuickCreateDraft({
      startDate: '2026-06-21',
      endDate: '2026-06-18',
      anchor: {x: 10, y: 20},
    })).toEqual({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      plannedEndDate: '2026-06-21',
      anchor: {x: 10, y: 20},
    });
  });

  it('omits plannedEndDate for one-day all-day drafts', () => {
    expect(buildAllDayQuickCreateDraft({
      startDate: '2026-06-18',
      endDate: '2026-06-18',
      anchor: {x: 10, y: 20},
    })).toEqual({
      kind: 'all-day',
      plannedDate: '2026-06-18',
      plannedEndDate: undefined,
      anchor: {x: 10, y: 20},
    });
  });

  it('calculates resize duration with hour-height-aware pixels', () => {
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 0,
      currentY: 32,
      hourHeight: 64,
    })).toBe(90);
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 0,
      currentY: 24,
      hourHeight: 48,
    })).toBe(90);
  });

  it('clamps resize duration to at least one slot', () => {
    expect(getResizeDurationMinutes({
      initialDurationMinutes: 60,
      startY: 100,
      currentY: 0,
      hourHeight: 64,
    })).toBe(15);
  });

  it('allows resize only when a 15 minute same-day end is possible', () => {
    expect(canResizeTimedTask('2026-06-06T23:44:00.000')).toBe(true);
    expect(canResizeTimedTask('2026-06-06T23:45:00.000')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/weekTimelineInteraction.test.ts
```

Expected: FAIL because `weekTimelineInteraction.ts` does not exist.

- [ ] **Step 3: Implement interaction helpers**

Create `src/modules/calendar/controllers/weekTimelineInteraction.ts`:

```ts
import {makeLocalDateTime} from '../../../../shared/lib/schedule';

export type WeekTimelineDensity = 'compact' | 'standard' | 'comfortable';

export const WEEK_TIMELINE_DENSITY_HEIGHTS: Record<WeekTimelineDensity, number> = {
  compact: 48,
  standard: 64,
  comfortable: 88,
};

export const MIN_TIMED_TASK_DURATION_MINUTES = 15;
export const DEFAULT_TIMED_TASK_DURATION_MINUTES = 60;
export const LATEST_TIMED_TASK_START_MINUTES = 23 * 60 + 44;
export const END_OF_DAY_MINUTES = 23 * 60 + 59;

export interface PopoverAnchor {
  x: number;
  y: number;
}

export type CalendarQuickCreateDraft =
  | {
      kind: 'timed';
      plannedDate: string;
      startAt: string;
      endAt: string;
      anchor: PopoverAnchor;
    }
  | {
      kind: 'all-day';
      plannedDate: string;
      plannedEndDate?: string;
      anchor: PopoverAnchor;
    };

export function hourHeightForDensity(density: WeekTimelineDensity): number {
  return WEEK_TIMELINE_DENSITY_HEIGHTS[density] ?? WEEK_TIMELINE_DENSITY_HEIGHTS.standard;
}

function snapMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.round(minutes / MIN_TIMED_TASK_DURATION_MINUTES) * MIN_TIMED_TASK_DURATION_MINUTES;
}

function clampStartMinute(minutes: number): number {
  return Math.min(Math.max(0, minutes), LATEST_TIMED_TASK_START_MINUTES);
}

function minuteFromPointer(input: {hour: number; clientY: number; rectTop: number; hourHeight: number}): number {
  const rawMinute = ((input.clientY - input.rectTop) / input.hourHeight) * 60;
  const minuteWithinHour = Math.min(45, Math.max(0, snapMinutes(rawMinute)));
  return clampStartMinute(input.hour * 60 + minuteWithinHour);
}

function makeDateTimeFromMinute(date: string, minuteOfDay: number): string {
  const clamped = Math.min(Math.max(0, minuteOfDay), END_OF_DAY_MINUTES);
  return makeLocalDateTime(date, Math.floor(clamped / 60), clamped % 60);
}

export function buildTimedQuickCreateDraftFromPoint(input: {
  date: string;
  hour: number;
  clientY: number;
  rectTop: number;
  hourHeight: number;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const startMinute = minuteFromPointer(input);
  const endMinute = Math.min(END_OF_DAY_MINUTES, startMinute + DEFAULT_TIMED_TASK_DURATION_MINUTES);
  const adjustedStart = endMinute - startMinute < MIN_TIMED_TASK_DURATION_MINUTES
    ? Math.max(0, endMinute - MIN_TIMED_TASK_DURATION_MINUTES)
    : startMinute;

  return {
    kind: 'timed',
    plannedDate: input.date,
    startAt: makeDateTimeFromMinute(input.date, adjustedStart),
    endAt: makeDateTimeFromMinute(input.date, endMinute),
    anchor: input.anchor,
  };
}

export function buildTimedQuickCreateDraftFromDrag(input: {
  date: string;
  startHour: number;
  startClientY: number;
  endHour: number;
  endClientY: number;
  startRectTop: number;
  endRectTop: number;
  hourHeight: number;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const startMinute = minuteFromPointer({
    hour: input.startHour,
    clientY: input.startClientY,
    rectTop: input.startRectTop,
    hourHeight: input.hourHeight,
  });
  const endMinute = minuteFromPointer({
    hour: input.endHour,
    clientY: input.endClientY,
    rectTop: input.endRectTop,
    hourHeight: input.hourHeight,
  });
  let rangeStart = Math.min(startMinute, endMinute);
  let rangeEnd = Math.max(startMinute, endMinute);
  if (rangeEnd - rangeStart < MIN_TIMED_TASK_DURATION_MINUTES) {
    rangeEnd = Math.min(END_OF_DAY_MINUTES, rangeStart + MIN_TIMED_TASK_DURATION_MINUTES);
  }
  if (rangeEnd > END_OF_DAY_MINUTES) {
    rangeEnd = END_OF_DAY_MINUTES;
    rangeStart = Math.min(rangeStart, LATEST_TIMED_TASK_START_MINUTES);
  }

  return {
    kind: 'timed',
    plannedDate: input.date,
    startAt: makeDateTimeFromMinute(input.date, rangeStart),
    endAt: makeDateTimeFromMinute(input.date, rangeEnd),
    anchor: input.anchor,
  };
}

export function buildAllDayQuickCreateDraft(input: {
  startDate: string;
  endDate: string;
  anchor: PopoverAnchor;
}): CalendarQuickCreateDraft {
  const plannedDate = input.startDate <= input.endDate ? input.startDate : input.endDate;
  const plannedEndDate = input.startDate <= input.endDate ? input.endDate : input.startDate;
  return {
    kind: 'all-day',
    plannedDate,
    plannedEndDate: plannedEndDate === plannedDate ? undefined : plannedEndDate,
    anchor: input.anchor,
  };
}

export function getResizeDurationMinutes(input: {
  initialDurationMinutes: number;
  startY: number;
  currentY: number;
  hourHeight: number;
}): number {
  const minutesPerPixel = 60 / input.hourHeight;
  const deltaMinutes = snapMinutes((input.currentY - input.startY) * minutesPerPixel);
  return Math.max(MIN_TIMED_TASK_DURATION_MINUTES, input.initialDurationMinutes + deltaMinutes);
}

export function canResizeTimedTask(startAt: string): boolean {
  const hour = Number(startAt.slice(11, 13));
  const minute = Number(startAt.slice(14, 16));
  return hour * 60 + minute <= LATEST_TIMED_TASK_START_MINUTES;
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/weekTimelineInteraction.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/weekTimelineInteraction.ts src/modules/calendar/controllers/weekTimelineInteraction.test.ts
git commit -m "feat: add week timeline interaction rules"
```

---

### Task 2: Calendar Settings Density

**Files:**
- Modify: `src/modules/calendar/controllers/calendarSettings.ts`
- Modify: `src/modules/calendar/controllers/calendarSettings.test.ts`

- [ ] **Step 1: Write failing settings tests**

Modify `src/modules/calendar/controllers/calendarSettings.test.ts`.

Update the default settings test:

```ts
expect(DEFAULT_CALENDAR_SETTINGS).toEqual({
  visibleCategoryIds: [],
  showCompleted: true,
  colorMode: 'category',
  showFocusSessions: true,
  weekTimelineDensity: 'standard',
});
```

Update the persistence test:

```ts
saveCalendarSettings({
  visibleCategoryIds: [1, 2],
  showCompleted: false,
  colorMode: 'category',
  showFocusSessions: false,
  weekTimelineDensity: 'comfortable',
});

expect(localStorage.getItem(CALENDAR_SETTINGS_STORAGE_KEY)).toContain('"weekTimelineDensity":"comfortable"');
expect(loadCalendarSettings()).toEqual({
  visibleCategoryIds: [1, 2],
  showCompleted: false,
  colorMode: 'category',
  showFocusSessions: false,
  weekTimelineDensity: 'comfortable',
});
```

Add a partial legacy settings test:

```ts
it('fills density from defaults for legacy stored settings', () => {
  localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify({
    visibleCategoryIds: [1],
    showCompleted: false,
    colorMode: 'category',
    showFocusSessions: false,
  }));

  expect(loadCalendarSettings()).toEqual({
    visibleCategoryIds: [1],
    showCompleted: false,
    colorMode: 'category',
    showFocusSessions: false,
    weekTimelineDensity: 'standard',
  });
});
```

Add an invalid density test:

```ts
it('ignores invalid stored density values', () => {
  localStorage.setItem(CALENDAR_SETTINGS_STORAGE_KEY, JSON.stringify({
    weekTimelineDensity: 'giant',
  }));

  expect(loadCalendarSettings().weekTimelineDensity).toBe('standard');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarSettings.test.ts
```

Expected: FAIL because `weekTimelineDensity` is not in `CalendarSettings`.

- [ ] **Step 3: Implement density setting**

Modify `src/modules/calendar/controllers/calendarSettings.ts`:

```ts
import type {WeekTimelineDensity} from './weekTimelineInteraction';

const WEEK_TIMELINE_DENSITIES = new Set<WeekTimelineDensity>(['compact', 'standard', 'comfortable']);

export interface CalendarSettings {
  visibleCategoryIds: number[];
  showCompleted: boolean;
  colorMode: 'category';
  showFocusSessions: boolean;
  weekTimelineDensity: WeekTimelineDensity;
}

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  visibleCategoryIds: [],
  showCompleted: true,
  colorMode: 'category',
  showFocusSessions: true,
  weekTimelineDensity: 'standard',
};

function parseWeekTimelineDensity(value: unknown): WeekTimelineDensity {
  return typeof value === 'string' && WEEK_TIMELINE_DENSITIES.has(value as WeekTimelineDensity)
    ? value as WeekTimelineDensity
    : DEFAULT_CALENDAR_SETTINGS.weekTimelineDensity;
}
```

In `loadCalendarSettings()`, include:

```ts
weekTimelineDensity: parseWeekTimelineDensity(parsed.weekTimelineDensity),
```

- [ ] **Step 4: Run settings tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarSettings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/controllers/calendarSettings.ts src/modules/calendar/controllers/calendarSettings.test.ts
git commit -m "feat: persist week timeline density"
```

---

### Task 3: Calendar API And Controller Quick Create Contract

**Files:**
- Modify: `src/modules/calendar/api/calendarApi.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.ts`
- Modify: `src/modules/calendar/controllers/useCalendarController.test.ts`

- [ ] **Step 1: Write failing controller tests**

Append tests to `src/modules/calendar/controllers/useCalendarController.test.ts`:

```ts
it('opens and closes a quick create draft', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

  const {result} = renderHook(() => useCalendarController({
    categories: [],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  act(() => result.current.openQuickCreateDraft({
    kind: 'timed',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    anchor: {x: 10, y: 20},
  }));

  expect(result.current.quickCreateDraft).toMatchObject({kind: 'timed'});

  act(() => result.current.closeQuickCreateDraft());
  expect(result.current.quickCreateDraft).toBeUndefined();
});

it('submits a timed quick create draft through calendarApi', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

  const {result} = renderHook(() => useCalendarController({
    categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  act(() => result.current.openQuickCreateDraft({
    kind: 'timed',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    anchor: {x: 10, y: 20},
  }));

  await act(async () => {
    const resultValue = await result.current.submitQuickCreateDraft({
      title: '写方案',
      categoryId: 8,
    });
    expect(resultValue).toEqual({ok: true});
  });

  expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
    title: '写方案',
    categoryId: 8,
    plannedDate: '2026-06-06',
    plannedEndDate: undefined,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });
  expect(result.current.quickCreateDraft).toBeUndefined();
});

it('submits an all-day quick create draft through calendarApi', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 1} as never);

  const {result} = renderHook(() => useCalendarController({
    categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  act(() => result.current.openQuickCreateDraft({
    kind: 'all-day',
    plannedDate: '2026-06-18',
    plannedEndDate: '2026-06-21',
    anchor: {x: 10, y: 20},
  }));

  await act(async () => {
    const resultValue = await result.current.submitQuickCreateDraft({
      title: '跨天事项',
      categoryId: 8,
    });
    expect(resultValue).toEqual({ok: true});
  });

  expect(calendarApi.createCalendarTask).toHaveBeenCalledWith({
    title: '跨天事项',
    categoryId: 8,
    plannedDate: '2026-06-18',
    plannedEndDate: '2026-06-21',
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  });
});

it('keeps the quick create draft and returns an error when create fails', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.createCalendarTask).mockRejectedValue(new Error('创建失败'));

  const {result} = renderHook(() => useCalendarController({
    categories: [{id: 8, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''}],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  act(() => result.current.openQuickCreateDraft({
    kind: 'timed',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    anchor: {x: 10, y: 20},
  }));

  await act(async () => {
    await expect(result.current.submitQuickCreateDraft({
      title: '写方案',
      categoryId: 8,
    })).resolves.toEqual({ok: false, message: '创建失败'});
  });

  expect(result.current.quickCreateDraft).toMatchObject({kind: 'timed'});
});

it('stores week timeline density through calendar settings', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

  const {result} = renderHook(() => useCalendarController({
    categories: [],
    initialDate: '2026-06-06',
    showToast: vi.fn(),
  }));

  act(() => result.current.setWeekTimelineDensity('comfortable'));

  expect(result.current.settings.weekTimelineDensity).toBe('comfortable');
});
```

- [ ] **Step 2: Run controller tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: FAIL because quick-create draft methods and wide `calendarApi.createCalendarTask` type do not exist.

- [ ] **Step 3: Widen calendar API create contract**

Modify `src/modules/calendar/api/calendarApi.ts`:

```ts
export interface CalendarCreateTaskInput {
  title: string;
  categoryId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

createCalendarTask(input: CalendarCreateTaskInput): Promise<Task> {
  return tasksApi.createTask(input);
},
```

- [ ] **Step 4: Add quick-create controller state and submit method**

Modify `src/modules/calendar/controllers/useCalendarController.ts`:

- import `type CalendarQuickCreateDraft, type WeekTimelineDensity`
- add `const [quickCreateDraft, setQuickCreateDraft] = useState<CalendarQuickCreateDraft | undefined>();`
- add:

```ts
function openQuickCreateDraft(draft: CalendarQuickCreateDraft): void {
  setQuickCreateDraft(draft);
}

function closeQuickCreateDraft(): void {
  setQuickCreateDraft(undefined);
}

function setWeekTimelineDensity(density: WeekTimelineDensity): void {
  setSettings({...settingsRef.current, weekTimelineDensity: density});
}

async function submitQuickCreateDraft(input: {title: string; categoryId: number}): Promise<{ok: true} | {ok: false; message: string}> {
  if (!quickCreateDraft) {
    return {ok: false, message: '没有可创建的任务'};
  }
  const title = input.title.trim();
  if (!title) {
    return {ok: false, message: '请输入任务标题'};
  }

  try {
    await calendarApi.createCalendarTask({
      title,
      categoryId: input.categoryId,
      plannedDate: quickCreateDraft.plannedDate,
      plannedEndDate: quickCreateDraft.kind === 'all-day' ? quickCreateDraft.plannedEndDate : undefined,
      startAt: quickCreateDraft.kind === 'timed' ? quickCreateDraft.startAt : undefined,
      endAt: quickCreateDraft.kind === 'timed' ? quickCreateDraft.endAt : undefined,
      allDay: quickCreateDraft.kind === 'all-day',
    });
    setQuickCreateDraft(undefined);
    await refreshCalendarData();
    await onMutationSuccess?.();
    return {ok: true};
  } catch (error) {
    return {ok: false, message: error instanceof Error ? error.message : '任务创建失败'};
  }
}
```

Return `quickCreateDraft`, `openQuickCreateDraft`, `closeQuickCreateDraft`, `submitQuickCreateDraft`, `setWeekTimelineDensity`.

- [ ] **Step 5: Run controller tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/useCalendarController.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/calendar/api/calendarApi.ts src/modules/calendar/controllers/useCalendarController.ts src/modules/calendar/controllers/useCalendarController.test.ts
git commit -m "feat: add calendar quick create controller"
```

---

### Task 4: Quick Create Popover Component

**Files:**
- Create: `src/modules/calendar/components/CalendarQuickCreatePopover.tsx`
- Create: `src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx`

- [ ] **Step 1: Write failing popover tests**

Create `src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx`:

```tsx
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {Category} from '../../../../shared/domain/entities';
import type {CalendarQuickCreateDraft} from '../controllers/weekTimelineInteraction';
import {CalendarQuickCreatePopover} from './CalendarQuickCreatePopover';

const categories: Category[] = [
  {id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 1, createdAt: '', updatedAt: ''},
  {id: 2, userId: 1, name: '学习', color: '#3b82f6', sortOrder: 2, createdAt: '', updatedAt: ''},
];

const timedDraft: CalendarQuickCreateDraft = {
  kind: 'timed',
  plannedDate: '2026-06-06',
  startAt: '2026-06-06T09:00:00.000',
  endAt: '2026-06-06T10:00:00.000',
  anchor: {x: 30, y: 40},
};

describe('CalendarQuickCreatePopover', () => {
  it('renders timed draft range and submits title/category', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ok: true});
    render(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={categories}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '写方案'}});
    fireEvent.change(screen.getByLabelText('任务分类'), {target: {value: '2'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({title: '写方案', categoryId: 2}));
  });

  it('renders all-day date range', () => {
    render(
      <CalendarQuickCreatePopover
        draft={{kind: 'all-day', plannedDate: '2026-06-18', plannedEndDate: '2026-06-21', anchor: {x: 0, y: 0}}}
        categories={categories}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('06-18 - 06-21')).toBeInTheDocument();
  });

  it('blocks empty titles with inline error', () => {
    const onSubmit = vi.fn();
    render(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={categories}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    expect(screen.getByText('请输入任务标题')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks submit when there are no categories', () => {
    const onSubmit = vi.fn();
    render(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={[]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('请先创建分类')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '保存'})).toBeDisabled();
  });

  it('keeps user input when submit fails', async () => {
    render(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={categories}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue({ok: false, message: '创建失败'})}
      />,
    );

    fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '写方案'}});
    fireEvent.click(screen.getByRole('button', {name: '保存'}));

    expect(await screen.findByText('创建失败')).toBeInTheDocument();
    expect(screen.getByLabelText('任务标题')).toHaveValue('写方案');
  });

  it('cancels from Escape and cancel button', () => {
    const onCancel = vi.fn();
    const {rerender} = render(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={categories}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(onCancel).toHaveBeenCalledOnce();

    rerender(
      <CalendarQuickCreatePopover
        draft={timedDraft}
        categories={categories}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: '取消'}));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement popover**

Create `src/modules/calendar/components/CalendarQuickCreatePopover.tsx`.

Required props:

```ts
interface CalendarQuickCreatePopoverProps {
  draft: CalendarQuickCreateDraft;
  categories: Category[];
  onCancel: () => void;
  onSubmit: (input: {title: string; categoryId: number}) => Promise<{ok: true} | {ok: false; message: string}>;
}
```

Implementation constraints:

- Use `role="dialog"` and `aria-label="快速创建任务"`.
- `aria-label="任务标题"` on title input.
- `aria-label="任务分类"` on select.
- Show range text as `HH:mm - HH:mm` for timed drafts and `MM-DD - MM-DD` for cross-day all-day drafts.
- Default category to first category ID.
- Inline error text for no category, empty title, and submit failure.
- Save button text must be `保存`; cancel button text must be `取消`.
- Keep form state if `onSubmit` returns `{ok:false}`.

- [ ] **Step 4: Run popover tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/components/CalendarQuickCreatePopover.tsx src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx
git commit -m "feat: add calendar quick create popover"
```

---

### Task 5: Week All-Day Continuous Segments

**Files:**
- Modify: `src/modules/calendar/controllers/calendarLayout.ts`
- Modify: `src/modules/calendar/controllers/calendarLayout.test.ts`
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/WeekTimelineView.test.tsx`

- [ ] **Step 1: Write failing pure segment tests**

Append to `src/modules/calendar/controllers/calendarLayout.test.ts`:

```ts
import {buildWeekAllDaySegments} from './calendarLayout';

it('builds week all-day segments for cross-day tasks', () => {
  expect(buildWeekAllDaySegments({
    dateFrom: '2026-06-15',
    dateTo: '2026-06-21',
    tasks: [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '跨天任务',
        plannedDate: '2026-06-18',
        plannedEndDate: '2026-06-21',
        allDay: true,
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ],
  })).toEqual([
    {
      taskId: 1,
      startsOn: '2026-06-18',
      endsOn: '2026-06-21',
      startIndex: 3,
      span: 4,
      continuesBefore: false,
      continuesAfter: false,
    },
  ]);
});

it('clips week all-day segments at visible boundaries', () => {
  expect(buildWeekAllDaySegments({
    dateFrom: '2026-06-15',
    dateTo: '2026-06-21',
    tasks: [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '跨周任务',
        plannedDate: '2026-06-13',
        plannedEndDate: '2026-06-23',
        allDay: true,
        status: 'TODO',
        createdAt: '',
        updatedAt: '',
      },
    ],
  })[0]).toMatchObject({
    startsOn: '2026-06-15',
    endsOn: '2026-06-21',
    startIndex: 0,
    span: 7,
    continuesBefore: true,
    continuesAfter: true,
  });
});
```

- [ ] **Step 2: Run layout tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarLayout.test.ts
```

Expected: FAIL because `buildWeekAllDaySegments` does not exist.

- [ ] **Step 3: Implement week all-day segment helper**

In `src/modules/calendar/controllers/calendarLayout.ts`, export:

```ts
export interface WeekAllDaySegment extends AllDaySegment {
  startIndex: number;
  span: number;
}

export function buildWeekAllDaySegments(input: {
  dateFrom: string;
  dateTo: string;
  tasks: Task[];
}): WeekAllDaySegment[] {
  return input.tasks
    .filter((task): task is Task & {plannedDate: string} => Boolean(task.plannedDate && task.allDay))
    .map((task) => {
      const segment = segmentAllDayTask(task, input.dateFrom, input.dateTo);
      return {
        ...segment,
        startIndex: enumerateDateRange(input.dateFrom, segment.startsOn).length - 1,
        span: enumerateDateRange(segment.startsOn, segment.endsOn).length,
      };
    })
    .sort((a, b) => a.startIndex - b.startIndex || b.span - a.span || a.taskId - b.taskId);
}
```

- [ ] **Step 4: Add failing week view continuous segment test**

Append to `src/modules/calendar/components/WeekTimelineView.test.tsx`:

```tsx
it('renders cross-day all-day tasks as one continuous segment', () => {
  renderWeek({
    tasksByDate: {
      '2026-06-04': [{
        ...task,
        id: 2,
        title: '跨天事项',
        plannedDate: '2026-06-04',
        plannedEndDate: '2026-06-07',
        allDay: true,
      }],
      '2026-06-05': [{
        ...task,
        id: 2,
        title: '跨天事项',
        plannedDate: '2026-06-04',
        plannedEndDate: '2026-06-07',
        allDay: true,
      }],
      '2026-06-06': [{
        ...task,
        id: 2,
        title: '跨天事项',
        plannedDate: '2026-06-04',
        plannedEndDate: '2026-06-07',
        allDay: true,
      }],
      '2026-06-07': [{
        ...task,
        id: 2,
        title: '跨天事项',
        plannedDate: '2026-06-04',
        plannedEndDate: '2026-06-07',
        allDay: true,
      }],
    },
  });

  expect(screen.getAllByText('跨天事项')).toHaveLength(1);
  expect(screen.getByLabelText('2026-06-04 至 2026-06-07 跨天事项')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run week view test and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/WeekTimelineView.test.tsx
```

Expected: FAIL because current week all-day lane renders one task per date.

- [ ] **Step 6: Render continuous all-day segments**

Modify `WeekTimelineView.tsx`:

- Build week visible start/end from `days`.
- De-dupe all all-day tasks by ID from `tasksByDate`.
- Use `buildWeekAllDaySegments`.
- Render a segment layer in the all-day header using CSS grid columns:

```tsx
style={{gridColumn: `${segment.startIndex + 2} / span ${segment.span}`}}
```

Column `1` is the left label column, so segment columns start at `2`.

- Keep all-day lane drop targets available per day.
- Segment labels use:

```tsx
aria-label={`${segment.startsOn} 至 ${segment.endsOn} ${task.title}`}
```

- [ ] **Step 7: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/components/WeekTimelineView.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/calendar/controllers/calendarLayout.ts src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/WeekTimelineView.test.tsx
git commit -m "feat: render week all-day spans"
```

---

### Task 6: Week Timeline Quick Create And Resize Wiring

**Files:**
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/WeekTimelineView.test.tsx`
- Modify: `src/modules/calendar/controllers/useTaskSchedulingActions.ts`
- Modify: `src/modules/calendar/controllers/useTaskSchedulingActions.test.ts`

- [ ] **Step 1: Extend WeekTimelineView props in tests**

Update `renderWeek()` in `WeekTimelineView.test.tsx` to pass:

```tsx
enableQuickCreate={false}
weekTimelineDensity="standard"
onOpenQuickCreate={vi.fn()}
```

Then add failing tests:

```tsx
it('opens quick create from a week time slot when enabled', () => {
  const onOpenQuickCreate = vi.fn();
  renderWeek({enableQuickCreate: true, onOpenQuickCreate});

  fireEvent.pointerDown(screen.getByLabelText('2026-06-06 09:00'), {clientY: 100, clientX: 20});
  fireEvent.pointerUp(screen.getByLabelText('2026-06-06 09:00'), {clientY: 100, clientX: 20});

  expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'timed',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
  }));
});

it('does not open quick create when disabled', () => {
  const onOpenQuickCreate = vi.fn();
  renderWeek({enableQuickCreate: false, onOpenQuickCreate});

  fireEvent.pointerDown(screen.getByLabelText('2026-06-06 09:00'), {clientY: 100, clientX: 20});
  fireEvent.pointerUp(screen.getByLabelText('2026-06-06 09:00'), {clientY: 100, clientX: 20});

  expect(onOpenQuickCreate).not.toHaveBeenCalled();
});

it('opens all-day quick create from a dragged all-day date range', () => {
  const onOpenQuickCreate = vi.fn();
  renderWeek({enableQuickCreate: true, onOpenQuickCreate});

  fireEvent.pointerDown(screen.getByLabelText('2026-06-04 全天'), {clientX: 10, clientY: 20});
  fireEvent.pointerUp(screen.getByLabelText('2026-06-06 全天'), {clientX: 50, clientY: 20});

  expect(onOpenQuickCreate).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'all-day',
    plannedDate: '2026-06-04',
    plannedEndDate: '2026-06-06',
  }));
});

it('does not open quick create for external drop payloads', () => {
  const onOpenQuickCreate = vi.fn();
  renderWeek({enableQuickCreate: true, onOpenQuickCreate});
  const data = createDragData();
  writeCalendarDragPayload(data, {type: 'calendar-task', taskId: 1, source: 'sidebar'});

  fireEvent.drop(screen.getByLabelText('2026-06-06 09:00'), {dataTransfer: data});

  expect(onOpenQuickCreate).not.toHaveBeenCalled();
});

it('uses density height for timeline rows', () => {
  renderWeek({weekTimelineDensity: 'comfortable'});
  expect(screen.getByLabelText('2026-06-06 09:00')).toHaveStyle({height: '88px'});
});
```

- [ ] **Step 2: Add failing resize action tests**

Append to `src/modules/calendar/controllers/useTaskSchedulingActions.test.ts`:

```ts
it('resizes a task without crossing the day boundary', async () => {
  const {result} = renderHook(() => useTaskSchedulingActions({
    showToast: vi.fn(),
    refreshCalendarData: vi.fn().mockResolvedValue(undefined),
  }));
  vi.mocked(calendarApi.updateTaskSchedule).mockResolvedValue({id: 1} as never);

  await act(async () => {
    await result.current.resizeTimedTask({
      taskId: 1,
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T23:00:00.000',
      durationMinutes: 90,
    });
  });

  expect(calendarApi.updateTaskSchedule).toHaveBeenCalledWith(1, expect.objectContaining({
    endAt: '2026-06-06T23:59:00.000',
  }));
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/WeekTimelineView.test.tsx src/modules/calendar/controllers/useTaskSchedulingActions.test.ts
```

Expected: FAIL because props/logic do not exist and resize still crosses day boundary.

- [ ] **Step 4: Implement WeekTimelineView quick-create wiring**

Modify `WeekTimelineView.tsx`:

- Add props:

```ts
enableQuickCreate: boolean;
weekTimelineDensity: WeekTimelineDensity;
onOpenQuickCreate: (draft: CalendarQuickCreateDraft) => void;
```

- Replace hard-coded `h-16` row heights with inline `height: `${hourHeight}px`` from `hourHeightForDensity`.
- Replace local `getResizeDurationMinutes` with imported helper.
- Hide resize handle when `!canResizeTimedTask(task.startAt)`.
- Add pointer handlers on empty time slots and all-day drop targets.
- In pointer handlers, ignore if `enableQuickCreate` is false.
- In drop handlers, keep existing scheduling behavior and do not open quick create.
- Use imported `buildTimedQuickCreateDraftFromPoint`, `buildTimedQuickCreateDraftFromDrag`, `buildAllDayQuickCreateDraft`.

- [ ] **Step 5: Clamp resize action end time**

Modify `useTaskSchedulingActions.ts`:

- Add a helper:

```ts
function addDurationWithinDay(startAt: string, durationMinutes: number): string {
  const date = startAt.slice(0, 10);
  const startMinutes = Number(startAt.slice(11, 13)) * 60 + Number(startAt.slice(14, 16));
  const endMinutes = Math.min(23 * 60 + 59, startMinutes + durationMinutes);
  return makeLocalDateTime(date, Math.floor(endMinutes / 60), endMinutes % 60);
}
```

- Use it in `resizeTimedTask`.
- Leave `moveTimedTask` behavior unchanged unless tests reveal an existing regression.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/WeekTimelineView.test.tsx src/modules/calendar/controllers/useTaskSchedulingActions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/WeekTimelineView.test.tsx src/modules/calendar/controllers/useTaskSchedulingActions.ts src/modules/calendar/controllers/useTaskSchedulingActions.test.ts
git commit -m "feat: wire week quick create interactions"
```

---

### Task 7: Full Calendar Integration, Toolbar Capabilities, And Sidebar Toggle

**Files:**
- Modify: `src/modules/calendar/components/CalendarToolbar.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarSurface.tsx`
- Modify: `src/modules/calendar/components/EmbeddedCalendarPanel.tsx`
- Modify: `src/modules/calendar/components/CalendarPanel.test.tsx`
- Modify: `src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx`

- [ ] **Step 1: Write failing CalendarPanel integration tests**

Append to `CalendarPanel.test.tsx`:

```tsx
it('opens and closes the scheduling sidebar from the toolbar', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  renderCalendarPanelWithSidebarTasks();

  expect(await screen.findByText('安排任务')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: '关闭安排任务'}));
  expect(screen.queryByText('未安排任务')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: '安排任务'}));
  expect(await screen.findByText('未安排任务')).toBeInTheDocument();
});

it('quick creates a timed task from the week timeline', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.createCalendarTask).mockResolvedValue({id: 99} as never);

  renderCalendarPanelWithSidebarTasks();

  fireEvent.pointerDown(screen.getByLabelText('2026-06-06 09:00'), {clientX: 100, clientY: 100});
  fireEvent.pointerUp(screen.getByLabelText('2026-06-06 09:00'), {clientX: 100, clientY: 100});

  expect(await screen.findByRole('dialog', {name: '快速创建任务'})).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('任务标题'), {target: {value: '写方案'}});
  fireEvent.click(screen.getByRole('button', {name: '保存'}));

  await waitFor(() => expect(calendarApi.createCalendarTask).toHaveBeenCalledWith(expect.objectContaining({
    title: '写方案',
    categoryId: 1,
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  })));
  await waitFor(() => expect(calendarApi.getUnscheduledTasks).toHaveBeenCalledTimes(2));
});

it('keeps quick create popover input when create fails', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);
  vi.mocked(calendarApi.createCalendarTask).mockRejectedValue(new Error('创建失败'));

  renderCalendarPanelWithSidebarTasks();

  fireEvent.pointerDown(screen.getByLabelText('2026-06-06 09:00'), {clientX: 100, clientY: 100});
  fireEvent.pointerUp(screen.getByLabelText('2026-06-06 09:00'), {clientX: 100, clientY: 100});
  fireEvent.change(await screen.findByLabelText('任务标题'), {target: {value: '写方案'}});
  fireEvent.click(screen.getByRole('button', {name: '保存'}));

  expect(await screen.findByText('创建失败')).toBeInTheDocument();
  expect(screen.getByLabelText('任务标题')).toHaveValue('写方案');
});

it('changes week timeline density from the toolbar', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

  renderCalendarPanel();

  fireEvent.click(screen.getByRole('button', {name: '宽松'}));
  expect(screen.getByLabelText('2026-06-06 09:00')).toHaveStyle({height: '88px'});
});

it('does not render fake tag or priority tabs in the scheduling sidebar', async () => {
  renderCalendarPanelWithSidebarTasks();

  await screen.findByText('未安排任务');
  expect(screen.queryByText('标签')).not.toBeInTheDocument();
  expect(screen.queryByText('优先级')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Write failing EmbeddedCalendarPanel tests**

Append to `EmbeddedCalendarPanel.test.tsx`:

```tsx
it('does not show full-calendar planning controls', async () => {
  vi.mocked(calendarApi.getCalendarTasks).mockResolvedValue([]);
  vi.mocked(calendarApi.getFocusSessions).mockResolvedValue([]);

  render(<EmbeddedCalendarPanel categories={categories} initialDate="2026-06-06" showToast={vi.fn()} onMutationSuccess={vi.fn()} />);

  expect(screen.queryByRole('button', {name: '安排任务'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '紧凑'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '标准'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '宽松'})).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx
```

Expected: FAIL because toolbar capabilities, popover integration, and sidebar toggle do not exist.

- [ ] **Step 4: Add CalendarToolbar capability props**

Modify `CalendarToolbar.tsx`:

```ts
import type {WeekTimelineDensity} from '../controllers/weekTimelineInteraction';

interface CalendarToolbarProps {
  view: CalendarView;
  anchorDate: string;
  setView: (view: CalendarView) => void;
  setAnchorDate: (date: string) => void;
  onOpenSettings?: () => void;
  showSchedulingToggle?: boolean;
  schedulingSidebarOpen?: boolean;
  onToggleSchedulingSidebar?: () => void;
  showWeekDensityControls?: boolean;
  weekTimelineDensity?: WeekTimelineDensity;
  onWeekTimelineDensityChange?: (density: WeekTimelineDensity) => void;
}
```

Render:

- scheduling toggle button only when `showSchedulingToggle`.
- density buttons only when `view === 'week' && showWeekDensityControls`.
- settings button only when `onOpenSettings` is provided.
- labels: `安排任务`, `关闭安排任务`, `紧凑`, `标准`, `宽松`.

- [ ] **Step 5: Wire CalendarPanel**

Modify `CalendarPanel.tsx`:

- Add `const [schedulingSidebarOpen, setSchedulingSidebarOpen] = useState(true);`
- Pass toolbar props:

```tsx
showSchedulingToggle
schedulingSidebarOpen={schedulingSidebarOpen}
onToggleSchedulingSidebar={() => setSchedulingSidebarOpen((open) => !open)}
showWeekDensityControls
weekTimelineDensity={controller.settings.weekTimelineDensity}
onWeekTimelineDensityChange={controller.setWeekTimelineDensity}
```

- Render `SchedulingSidebar` only when `schedulingSidebarOpen`.
- Change layout grid class based on sidebar state:

```tsx
className={schedulingSidebarOpen ? 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid grid-cols-1 gap-4'}
```

- Render `CalendarQuickCreatePopover` when `controller.quickCreateDraft`.
- Pass `controller.submitQuickCreateDraft` and `controller.closeQuickCreateDraft`.

- [ ] **Step 6: Wire CalendarSurface and EmbeddedCalendarPanel**

Modify `CalendarSurface.tsx`:

- Add props:

```ts
enableQuickCreate?: boolean;
weekTimelineDensity?: WeekTimelineDensity;
onOpenQuickCreate?: (draft: CalendarQuickCreateDraft) => void;
```

- Pass to `WeekTimelineView`.
- Defaults: `enableQuickCreate = false`, density = `standard`, noop `onOpenQuickCreate`.

Modify `EmbeddedCalendarPanel.tsx`:

- Call `CalendarToolbar` without scheduling/density capability props.
- Pass `enableQuickCreate={false}` to `CalendarSurface`.

- [ ] **Step 7: Run integration tests and verify GREEN**

Run:

```bash
npm test -- src/modules/calendar/components/CalendarPanel.test.tsx src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/calendar/components/CalendarToolbar.tsx src/modules/calendar/components/CalendarPanel.tsx src/modules/calendar/components/CalendarSurface.tsx src/modules/calendar/components/EmbeddedCalendarPanel.tsx src/modules/calendar/components/CalendarPanel.test.tsx src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx
git commit -m "feat: integrate week planning controls"
```

---

### Task 8: Full Regression And Final Cleanup

**Files:**
- Inspect all changed files from Tasks 1-7.

- [ ] **Step 1: Run focused calendar tests**

Run:

```bash
npm test -- \
  src/modules/calendar/controllers/weekTimelineInteraction.test.ts \
  src/modules/calendar/controllers/calendarSettings.test.ts \
  src/modules/calendar/controllers/useCalendarController.test.ts \
  src/modules/calendar/controllers/useTaskSchedulingActions.test.ts \
  src/modules/calendar/controllers/calendarLayout.test.ts \
  src/modules/calendar/controllers/weekTimelineLayout.test.ts \
  src/modules/calendar/components/CalendarQuickCreatePopover.test.tsx \
  src/modules/calendar/components/WeekTimelineView.test.tsx \
  src/modules/calendar/components/CalendarPanel.test.tsx \
  src/modules/calendar/components/EmbeddedCalendarPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: PASS with `tsc --noEmit`.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Review changed file boundaries**

Run:

```bash
git diff --stat HEAD~7..HEAD
git status --short
```

Expected:

- Calendar changes stay under `src/modules/calendar` plus shared tests already touched by the plan.
- No backend files changed.
- No `.superpowers/` files tracked.

- [ ] **Step 7: Commit final cleanup if needed**

If Step 1-6 required cleanup edits, inspect the dirty files first:

```bash
git status --short
```

Then stage only the cleanup files reported by `git status --short` and commit them. For example, if the cleanup touched the week timeline view and its test:

```bash
git add src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/WeekTimelineView.test.tsx
git commit -m "fix: polish week planning interactions"
```

If no cleanup edits are needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Time-axis quick create: Tasks 1, 3, 4, 6, 7.
- All-day multi-day quick create: Tasks 1, 3, 4, 5, 6, 7.
- Shared inline popover: Tasks 3, 4, 7.
- Timed resize hardening: Tasks 1, 6.
- Density settings and hour-height-aware conversion: Tasks 1, 2, 6, 7.
- Scheduling sidebar entry/close state: Task 7.
- Full vs embedded capability boundary: Task 7.
- Cross-day all-day continuous week display: Task 5.
- No fake tags/priority UI: Task 7.
- Regression verification: Task 8.

Placeholder scan: no `TBD`, `TODO`, or "implement later" placeholders are intended in this plan.

Type consistency:

- `WeekTimelineDensity` values are `compact | standard | comfortable`.
- `CalendarQuickCreateDraft` has `timed` and `all-day` variants.
- `calendarApi.createCalendarTask` accepts the same fields as `tasksApi.createTask` needs for scheduled tasks.
- `useCalendarController` owns quick-create draft state and exposes `openQuickCreateDraft`, `closeQuickCreateDraft`, `submitQuickCreateDraft`, and `setWeekTimelineDensity`.
