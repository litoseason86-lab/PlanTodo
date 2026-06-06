# Calendar Scheduling Phase 2.1a Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tasks support an unscheduled state, expose the backend/API contract needed by the later scheduling sidebar, and keep existing calendar, reports, focus, and task-list behavior coherent.

**Architecture:** `plannedDate` becomes optional at the shared domain boundary and nullable only at the SQLite storage boundary. Service owns schedule normalization and validation, repositories own persistence/filtering/atomic batch writes, and HTTP/API layers only parse wire formats and route calls. This phase deliberately avoids the scheduling sidebar UI; it only adds minimal frontend type compatibility so the app still builds after unscheduled tasks exist.

**Tech Stack:** TypeScript, Express, Vitest, better-sqlite3, JSON file storage, React.

---

## Current State Check

Use `/Users/zerionlito/code/PlanTodo` as the project root. The IDE-provided path `/Users/zerionlito/code/PlanTodo/.worktrees/calendar-scheduling-implementation` is currently an empty directory, not a valid Git worktree.

Before executing this plan:

```bash
git status --short
npm test
npm run lint
npm run build
```

Expected before implementation:

- `git status --short` may show existing uncommitted calendar Phase 1 fixes in `server/modules/tasks/service.ts`, `shared/lib/schedule.ts`, calendar tests/components, and `.superpowers/`.
- Do not revert those files. If a task edits an already dirty file, inspect the diff first and preserve the existing changes.
- If baseline tests fail because of the known old schema test that still accepts cross-day timed tasks, keep that fact attached to Task 2. Do not "fix" it by allowing cross-day timed tasks again.

## File Structure

- Modify: `shared/domain/entities.ts` - make `Task.plannedDate` optional.
- Modify: `shared/lib/schedule.ts` - add unscheduled schedule kind and guard all date-range helpers.
- Modify: `shared/lib/schedule.test.ts` - cover unscheduled normalization/intersection and existing no-cross-midnight helper behavior.
- Modify: `server/modules/tasks/repository.ts` - extend filters and repository contract for optional schedules and atomic batch schedule updates.
- Modify: `server/modules/tasks/schemas.ts` - parse optional/null `plannedDate`, scheduled/query filters, single unschedule, and batch request bodies.
- Modify: `server/modules/tasks/schemas.test.ts` - cover new parse behavior and replace the stale "cross-day timed schedule parses" expectation with a rejection test.
- Modify: `server/modules/tasks/service.ts` - normalize schedules, allow unscheduled creation/update, add atomic batch service methods.
- Modify: `server/modules/tasks/tasks.service.test.ts` - cover unscheduled creation/update, batch validation, and no partial success.
- Modify: `server/modules/tasks/routes.ts` - add static batch routes before parameterized routes and pass extended filters.
- Create: `server/modules/tasks/routes.test.ts` - verify batch route ordering and single-task unschedule route behavior.
- Modify: `server/storage/json/repositories/taskJsonRepository.ts` - read/write optional `plannedDate`, scheduled/query filters, and batch updates inside one store update.
- Modify: `server/storage/json/repositories/taskJsonRepository.test.ts` - cover JSON unscheduled reads/writes/filtering/batch atomicity.
- Modify: `server/storage/sqlite/migrations.ts` - add V4 table rebuild so `tasks.planned_date` is nullable, with foreign-key-safe migration execution.
- Modify: `server/storage/sqlite/sqliteClient.test.ts` - cover V4 migration version and V3 database upgrade with existing execution sessions.
- Modify: `server/storage/sqlite/repositories/rowMappers.ts` - map nullable `planned_date` to omitted `plannedDate`.
- Modify: `server/storage/sqlite/repositories/rowMappers.test.ts` - cover nullable row mapping.
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.ts` - SQL filtering for scheduled states/query and transaction-backed batch writes.
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts` - cover nullable migration, filters, and batch atomicity.
- Modify: `scripts/importJsonToSqlite.ts` - import `plannedDate?: string | null` as `planned_date = null` with cleared schedule fields.
- Modify: `scripts/importJsonToSqlite.test.ts` - cover importing unscheduled JSON tasks.
- Modify: `src/modules/tasks/api/tasksApi.ts` - expose scheduled/query filters, optional create schedule, single unschedule, and batch APIs.
- Modify: `src/modules/tasks/api/tasksApi.test.ts` - cover new query strings and request bodies.
- Modify: `src/modules/tasks/controllers/useTasksController.ts` - exclude unscheduled tasks from date scopes without unsafe comparisons.
- Modify: `src/modules/tasks/controllers/taskFilters.test.ts` - cover unscheduled task filtering.
- Modify: `src/modules/tasks/components/TasksPanel.tsx` - display `未安排` when `plannedDate` is missing.
- Modify: `src/modules/tasks/components/TasksPanel.test.tsx` - cover unscheduled display.
- Modify: `src/modules/calendar/controllers/calendarLayout.ts` - keep unscheduled tasks out of calendar grouping/segmentation.
- Modify: `src/modules/calendar/controllers/calendarLayout.test.ts` - cover unscheduled tasks not appearing in date groups.
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx` - keep timed-task resize state typed safely when `plannedDate` is optional.
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx` - ignore malformed unscheduled tasks passed in `tasksByDate` instead of crashing render.
- Modify: `src/modules/calendar/components/MonthCalendarView.test.tsx` - cover malformed unscheduled tasks in date groups do not render or crash.
- Modify: `src/modules/calendar/api/calendarApi.ts` - align `TaskSchedulePayload` with optional/null planned date while preserving calendar creation as scheduled.

---

### Task 1: Shared Task Schedule Semantics

**Files:**
- Modify: `shared/domain/entities.ts`
- Modify: `shared/lib/schedule.ts`
- Modify: `shared/lib/schedule.test.ts`

- [ ] **Step 1: Write failing unscheduled schedule helper tests**

Append these tests to `shared/lib/schedule.test.ts`:

```ts
it('normalizes tasks without plannedDate as unscheduled all-day tasks', () => {
  const unscheduled = toCanonicalTask({
    ...baseTask,
    plannedDate: undefined,
    plannedEndDate: '2026-06-08',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });

  expect(unscheduled).toMatchObject({
    plannedDate: undefined,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  });
  expect(getTaskScheduleKind(unscheduled)).toBe('unscheduled');
});

it('does not intersect unscheduled tasks with any date range', () => {
  expect(taskIntersectsDateRange({
    ...baseTask,
    plannedDate: undefined,
  }, '2026-06-01', '2026-06-30')).toBe(false);
});
```

If `baseTask` is typed as requiring `plannedDate`, change its declaration in the same test file to:

```ts
const baseTask: Omit<Task, 'plannedDate' | 'allDay'> & {plannedDate?: string; allDay?: boolean} = {
```

- [ ] **Step 2: Run the helper test and verify RED**

Run:

```bash
npm test -- shared/lib/schedule.test.ts
```

Expected: FAIL because `Task.plannedDate` is required and `TaskScheduleKind` does not include `unscheduled`.

- [ ] **Step 3: Make `Task.plannedDate` optional**

In `shared/domain/entities.ts`, change the `Task` schedule field from:

```ts
plannedDate: string;
```

to:

```ts
plannedDate?: string;
```

- [ ] **Step 4: Update shared schedule helpers**

In `shared/lib/schedule.ts`, replace the schedule kind and `LegacyTask` definitions with:

```ts
export type TaskScheduleKind = 'unscheduled' | 'date' | 'cross-day' | 'timed';
export type LegacyTask = Omit<Task, 'plannedDate' | 'allDay'> & {
  plannedDate?: string;
  allDay?: boolean;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
};
```

Replace `toCanonicalTask`, `getTaskScheduleKind`, and `taskIntersectsDateRange` with:

```ts
export function toCanonicalTask(task: LegacyTask): Task {
  if (!task.plannedDate) {
    return {
      ...task,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    };
  }

  const allDay = task.allDay ?? true;

  return {
    ...task,
    allDay,
    plannedEndDate: allDay ? task.plannedEndDate || undefined : undefined,
    startAt: allDay ? undefined : task.startAt || undefined,
    endAt: allDay ? undefined : task.endAt || undefined,
  };
}

export function getTaskScheduleKind(task: LegacyTask): TaskScheduleKind {
  const canonical = toCanonicalTask(task);
  if (!canonical.plannedDate) {
    return 'unscheduled';
  }
  if (!canonical.allDay && canonical.startAt && canonical.endAt) {
    return 'timed';
  }
  if (canonical.plannedEndDate && canonical.plannedEndDate !== canonical.plannedDate) {
    return 'cross-day';
  }
  return 'date';
}

export function taskIntersectsDateRange(task: LegacyTask, dateFrom: string, dateTo: string): boolean {
  const canonical = toCanonicalTask(task);
  if (!canonical.plannedDate) {
    return false;
  }

  const startDate = canonical.startAt ? getLocalDateFromDateTime(canonical.startAt) : canonical.plannedDate;
  const endDate = canonical.endAt
    ? getLocalDateFromDateTime(canonical.endAt)
    : canonical.plannedEndDate ?? canonical.plannedDate;

  return startDate <= dateTo && endDate >= dateFrom;
}
```

Keep the existing `addMinutesToLocalDateTime` day-boundary rejection. Do not re-enable cross-midnight timed helpers.

- [ ] **Step 5: Run helper tests and lint**

Run:

```bash
npm test -- shared/lib/schedule.test.ts
npm run lint
```

Expected: helper tests PASS; lint may still fail in downstream files that assume `plannedDate: string`. Those downstream failures are expected until later tasks.

- [ ] **Step 6: Commit Task 1**

```bash
git add shared/domain/entities.ts shared/lib/schedule.ts shared/lib/schedule.test.ts
git commit -m "feat: support unscheduled task schedule semantics"
```

---

### Task 2: Task Schema Parsing

**Files:**
- Modify: `server/modules/tasks/schemas.ts`
- Modify: `server/modules/tasks/schemas.test.ts`

- [ ] **Step 1: Add failing schema tests**

First update the import in `server/modules/tasks/schemas.test.ts`:

```ts
import {
  parseBatchScheduleBody,
  parseBatchUnscheduleBody,
  parseTaskBody,
  parseTaskQuery,
  parseTaskScheduleBody,
} from './schemas';
```

Append these tests:

```ts
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
```

Also replace the existing stale test named `parses cross-day timed task schedule body` with the rejection version above. There must not be one test expecting cross-day timed tasks to parse successfully.

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
npm test -- server/modules/tasks/schemas.test.ts
```

Expected: FAIL because `plannedDate` is still required, filters do not support `scheduled/query`, and batch body parsers do not exist.

- [ ] **Step 3: Extend schema types**

In `server/modules/tasks/schemas.ts`, update interfaces:

```ts
type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';

export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface TaskScheduleBody {
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export interface TaskQueryParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
  scheduled?: ScheduledFilter;
  query?: string;
}

export interface BatchScheduleBody {
  taskIds: number[];
  plannedDate: string;
}

export interface BatchUnscheduleBody {
  taskIds: number[];
}
```

- [ ] **Step 4: Add schedule normalization helpers**

In `server/modules/tasks/schemas.ts`, add:

```ts
function parseNullableIsoDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parseOptionalIsoDate(value, fieldName);
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new AppError(400, `${fieldName} must be a boolean`);
  }
  return value;
}

function assertScheduleBodyRules(body: TaskScheduleBody): void {
  if (!body.plannedDate) {
    if (!body.allDay) {
      throw new AppError(400, 'Timed task requires plannedDate');
    }
    return;
  }
  if (body.plannedEndDate && body.plannedEndDate < body.plannedDate) {
    throw new AppError(400, 'plannedEndDate must be after plannedDate');
  }
  if (!body.allDay && (!body.startAt || !body.endAt)) {
    throw new AppError(400, 'Timed task requires startAt and endAt');
  }
  if (body.startAt && body.endAt && body.endAt <= body.startAt) {
    throw new AppError(400, 'endAt must be after startAt');
  }
  if (!body.allDay && body.startAt?.slice(0, 10) !== body.plannedDate) {
    throw new AppError(400, 'Timed task date must match plannedDate');
  }
  if (!body.allDay && body.endAt?.slice(0, 10) !== body.plannedDate) {
    throw new AppError(400, 'Cross-day timed tasks are not supported yet');
  }
}

function normalizeSchedulePayload(payload: Record<string, unknown>, requireAllDay: boolean): TaskScheduleBody {
  const plannedDate = parseNullableIsoDate(payload.plannedDate, 'plannedDate');
  const requestedAllDay = parseOptionalBoolean(payload.allDay, 'allDay');

  if (!plannedDate) {
    if (requestedAllDay === false) {
      throw new AppError(400, 'Timed task requires plannedDate');
    }
    return {
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    };
  }

  const startAt = parseOptionalLocalDateTime(payload.startAt, 'startAt');
  const endAt = parseOptionalLocalDateTime(payload.endAt, 'endAt');
  const allDay = requestedAllDay ?? !(startAt && endAt);

  if (requireAllDay && requestedAllDay === undefined) {
    throw new AppError(400, 'allDay must be a boolean');
  }

  const schedule: TaskScheduleBody = {
    plannedDate,
    plannedEndDate: plannedDate && allDay ? parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate') : undefined,
    startAt: plannedDate && !allDay ? startAt : undefined,
    endAt: plannedDate && !allDay ? endAt : undefined,
    allDay: plannedDate ? allDay : true,
  };
  assertScheduleBodyRules(schedule);
  return schedule;
}
```

Remove the old `assertScheduleBodyRules` implementation after replacing it.

- [ ] **Step 5: Update body/query parsers**

Use these parser implementations in `server/modules/tasks/schemas.ts`:

```ts
export function parseTaskBody(body: unknown): TaskBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const categoryId = Number.parseInt(String(payload.categoryId), 10);
  if (Number.isNaN(categoryId)) {
    throw new AppError(400, 'Valid categoryId is required');
  }

  const schedule = normalizeSchedulePayload(payload, false);
  return {
    title: typeof payload.title === 'string' ? payload.title : '',
    categoryId,
    ...schedule,
  };
}

export function parseTaskQuery(query: Record<string, unknown>): TaskQueryParams {
  const date = parseOptionalIsoDate(query.date, 'date');
  const dateFrom = parseOptionalIsoDate(query.dateFrom, 'dateFrom');
  const dateTo = parseOptionalIsoDate(query.dateTo, 'dateTo');

  if (date && (dateFrom || dateTo)) {
    throw new AppError(400, 'Use either date or dateFrom/dateTo');
  }
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    throw new AppError(400, 'dateFrom and dateTo must be provided together');
  }
  if (dateFrom && dateTo && dateTo < dateFrom) {
    throw new AppError(400, 'dateTo must be after dateFrom');
  }

  const scheduled = typeof query.scheduled === 'string' ? query.scheduled : undefined;
  if (scheduled && !['unscheduled', 'scheduled', 'all-day-without-time'].includes(scheduled)) {
    throw new AppError(400, 'scheduled must be one of: unscheduled, scheduled, all-day-without-time');
  }
  if (scheduled === 'unscheduled' && (date || dateFrom || dateTo)) {
    throw new AppError(400, 'scheduled=unscheduled cannot be combined with date filters');
  }

  const categoryIdValue = query.categoryId;
  const parsedCategoryId =
    typeof categoryIdValue === 'string' ? Number.parseInt(categoryIdValue, 10) : undefined;
  const trimmedQuery = typeof query.query === 'string' ? query.query.trim() : undefined;

  return {
    date,
    dateFrom,
    dateTo,
    status: typeof query.status === 'string' && TASK_STATUSES.includes(query.status as TaskStatus)
      ? (query.status as TaskStatus)
      : undefined,
    categoryId:
      parsedCategoryId !== undefined && !Number.isNaN(parsedCategoryId)
        ? parsedCategoryId
        : undefined,
    scheduled: scheduled as ScheduledFilter | undefined,
    query: trimmedQuery || undefined,
  };
}

export function parseTaskScheduleBody(body: unknown): TaskScheduleBody {
  return normalizeSchedulePayload((body ?? {}) as Record<string, unknown>, true);
}
```

- [ ] **Step 6: Add batch parsers**

Add to `server/modules/tasks/schemas.ts`:

```ts
function parseTaskIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, 'taskIds must be a non-empty array');
  }

  const taskIds = value.map((item) => {
    const id = typeof item === 'number'
      ? item
      : typeof item === 'string' && /^[1-9]\d*$/.test(item)
        ? Number.parseInt(item, 10)
        : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, 'taskIds must contain positive integers');
    }
    return id;
  });

  if (new Set(taskIds).size !== taskIds.length) {
    throw new AppError(400, 'taskIds must be unique');
  }

  return taskIds;
}

export function parseBatchScheduleBody(body: unknown): BatchScheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const plannedDate = parseOptionalIsoDate(payload.plannedDate, 'plannedDate');
  if (!plannedDate) {
    throw new AppError(400, 'Invalid plannedDate');
  }
  return {
    taskIds: parseTaskIds(payload.taskIds),
    plannedDate,
  };
}

export function parseBatchUnscheduleBody(body: unknown): BatchUnscheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  return {
    taskIds: parseTaskIds(payload.taskIds),
  };
}
```

- [ ] **Step 7: Run schema tests**

Run:

```bash
npm test -- server/modules/tasks/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add server/modules/tasks/schemas.ts server/modules/tasks/schemas.test.ts
git commit -m "feat: parse unscheduled task schedules"
```

---

### Task 3: Repository Contract and Task Service

**Files:**
- Modify: `server/modules/tasks/repository.ts`
- Modify: `server/modules/tasks/service.ts`
- Modify: `server/modules/tasks/tasks.service.test.ts`

- [ ] **Step 1: Add failing service tests**

Add a local repository factory near the top of `server/modules/tasks/tasks.service.test.ts`:

```ts
function buildTaskRepository(overrides = {}) {
  return {
    listByFilters: vi.fn(() => []),
    getById: vi.fn(),
    create: vi.fn((input) => ({
      id: 1,
      status: 'TODO',
      createdAt: '',
      updatedAt: '',
      ...input,
    })),
    updateStatus: vi.fn(),
    updateSchedule: vi.fn((input) => ({
      id: input.taskId,
      userId: input.userId,
      categoryId: 1,
      title: '写方案',
      status: 'TODO',
      createdAt: '',
      updatedAt: '',
      plannedDate: input.plannedDate,
      plannedEndDate: input.plannedEndDate,
      startAt: input.startAt,
      endAt: input.endAt,
      allDay: input.allDay,
    })),
    batchUpdateSchedules: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

function existingTask(id: number, userId = 1) {
  return {
    id,
    userId,
    categoryId: 1,
    title: `任务${id}`,
    plannedDate: '2026-06-06',
    allDay: true,
    status: 'TODO',
    createdAt: '',
    updatedAt: '',
  } as const;
}
```

Update the existing inline repository mocks in this file to use `buildTaskRepository()` or add `batchUpdateSchedules: vi.fn()` to every mock object. `TaskRepository` becomes wider in this task, and `npm run lint` type-checks tests.

Append tests:

```ts
it('creates unscheduled tasks after category validation', () => {
  const repository = buildTaskRepository();
  const service = new TasksService(
    repository,
    {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  service.create({
    userId: 1,
    categoryId: 1,
    title: '  收集资料  ',
    plannedDate: undefined,
    allDay: true,
  });

  expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
    title: '收集资料',
    plannedDate: undefined,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  }));
});

it('unschedules a task through schedule update', () => {
  const repository = buildTaskRepository({
    getById: vi.fn(() => existingTask(1)),
  });
  const service = new TasksService(
    repository,
    {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  service.updateSchedule({
    taskId: 1,
    userId: 1,
    plannedDate: undefined,
    allDay: true,
  });

  expect(repository.updateSchedule).toHaveBeenCalledWith(expect.objectContaining({
    taskId: 1,
    userId: 1,
    plannedDate: undefined,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  }));
});

it('batch schedules only after every task exists for the user', () => {
  const repository = buildTaskRepository({
    getById: vi.fn((taskId: number, userId: number) => existingTask(taskId, userId)),
    batchUpdateSchedules: vi.fn(() => [existingTask(1), existingTask(2)]),
  });
  const service = new TasksService(
    repository,
    {getById: vi.fn()},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  service.batchScheduleDate({userId: 1, taskIds: [1, 2], plannedDate: '2026-06-08'});

  expect(repository.getById).toHaveBeenCalledTimes(2);
  expect(repository.batchUpdateSchedules).toHaveBeenCalledWith([
    {taskId: 1, userId: 1, plannedDate: '2026-06-08', plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
    {taskId: 2, userId: 1, plannedDate: '2026-06-08', plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
  ]);
});

it('does not partially batch schedule when any task is missing', () => {
  const repository = buildTaskRepository({
    getById: vi.fn((taskId: number) => taskId === 2 ? undefined : existingTask(taskId)),
    batchUpdateSchedules: vi.fn(),
  });
  const service = new TasksService(
    repository,
    {getById: vi.fn()},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  expect(() => service.batchScheduleDate({userId: 1, taskIds: [1, 2], plannedDate: '2026-06-08'}))
    .toThrow('Task not found');
  expect(repository.batchUpdateSchedules).not.toHaveBeenCalled();
});

it('rejects invalid batch task ids before reading tasks', () => {
  const repository = buildTaskRepository({
    getById: vi.fn(),
    batchUpdateSchedules: vi.fn(),
  });
  const service = new TasksService(
    repository,
    {getById: vi.fn()},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  expect(() => service.batchUnschedule({userId: 1, taskIds: [1.9]})).toThrow('taskIds must contain positive integers');
  expect(repository.getById).not.toHaveBeenCalled();
  expect(repository.batchUpdateSchedules).not.toHaveBeenCalled();
});

it('batch unschedules tasks as all-day unscheduled tasks', () => {
  const repository = buildTaskRepository({
    getById: vi.fn((taskId: number, userId: number) => existingTask(taskId, userId)),
    batchUpdateSchedules: vi.fn(() => [existingTask(1), existingTask(2)]),
  });
  const service = new TasksService(
    repository,
    {getById: vi.fn()},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  service.batchUnschedule({userId: 1, taskIds: [1, 2]});

  expect(repository.batchUpdateSchedules).toHaveBeenCalledWith([
    {taskId: 1, userId: 1, plannedDate: undefined, plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
    {taskId: 2, userId: 1, plannedDate: undefined, plannedEndDate: undefined, startAt: undefined, endAt: undefined, allDay: true},
  ]);
});
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```bash
npm test -- server/modules/tasks/tasks.service.test.ts
```

Expected: FAIL because repository contract/service methods do not support optional schedules or batch methods.

- [ ] **Step 3: Extend repository contract**

In `server/modules/tasks/repository.ts`, replace the current interfaces with these compatible definitions:

```ts
export type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';

export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
  scheduled?: ScheduledFilter;
  query?: string;
}

export interface CreateTaskInput {
  userId: number;
  categoryId: number;
  title: string;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface UpdateTaskScheduleInput {
  taskId: number;
  userId: number;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export interface BatchTaskScheduleInput extends UpdateTaskScheduleInput {}

export interface TaskRepository {
  listByFilters(filters: TaskFilters): Task[];
  getById(taskId: number, userId: number): Task | undefined;
  create(input: CreateTaskInput): Task;
  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined;
  updateSchedule(input: UpdateTaskScheduleInput): Task | undefined;
  batchUpdateSchedules(inputs: BatchTaskScheduleInput[]): Task[];
  remove(taskId: number, userId: number): boolean;
}
```

- [ ] **Step 4: Update service filter and validation types**

In `server/modules/tasks/service.ts`, import `BatchTaskScheduleInput` and `ScheduledFilter`, then extend `TaskListFilters`:

```ts
interface TaskListFilters {
  userId: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
  scheduled?: ScheduledFilter;
  query?: string;
}
```

Update `list()` to pass `scheduled` and `query` through.

- [ ] **Step 5: Normalize schedule data in service**

Add these private methods inside `TasksService`:

```ts
private normalizeSchedule(input: UpdateTaskScheduleInput): UpdateTaskScheduleInput {
  if (!input.plannedDate) {
    return {
      taskId: input.taskId,
      userId: input.userId,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    };
  }

  if (input.allDay) {
    return {
      ...input,
      plannedEndDate: input.plannedEndDate,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    };
  }

  return {
    ...input,
    plannedEndDate: undefined,
    allDay: false,
  };
}

private validateSchedule(input: UpdateTaskScheduleInput): void {
  if (!input.plannedDate) {
    if (!input.allDay) {
      throw new AppError(400, 'Timed task requires plannedDate');
    }
    return;
  }
  if (!isIsoDateString(input.plannedDate)) {
    throw new AppError(400, 'Invalid plannedDate');
  }
  if (input.plannedEndDate && input.plannedEndDate < input.plannedDate) {
    throw new AppError(400, 'plannedEndDate must be after plannedDate');
  }
  if (!input.allDay && (!input.startAt || !input.endAt)) {
    throw new AppError(400, 'Timed task requires startAt and endAt');
  }
  if (input.startAt && input.endAt && input.endAt <= input.startAt) {
    throw new AppError(400, 'endAt must be after startAt');
  }
  if (!input.allDay && input.startAt?.slice(0, 10) !== input.plannedDate) {
    throw new AppError(400, 'Timed task date must match plannedDate');
  }
  if (!input.allDay && input.endAt?.slice(0, 10) !== input.plannedDate) {
    throw new AppError(400, 'Cross-day timed tasks are not supported yet');
  }
}

private assertPositiveTaskIds(taskIds: number[]): void {
  if (taskIds.length === 0) {
    throw new AppError(400, 'taskIds must be a non-empty array');
  }
  if (taskIds.some((taskId) => !Number.isSafeInteger(taskId) || taskId <= 0)) {
    throw new AppError(400, 'taskIds must contain positive integers');
  }
  if (new Set(taskIds).size !== taskIds.length) {
    throw new AppError(400, 'taskIds must be unique');
  }
}
```

If the file already contains the cross-day rejection from a dirty working-tree change, preserve it in this replacement.

- [ ] **Step 6: Normalize create/update schedule paths**

In `create()`, build a normalized schedule before calling `validateSchedule()`:

```ts
  const scheduleInput = {
  taskId: 0,
  userId: input.userId,
  plannedDate: input.plannedDate,
  plannedEndDate: input.plannedEndDate,
  startAt: input.startAt,
  endAt: input.endAt,
  allDay: input.allDay ?? true,
};
this.validateSchedule(scheduleInput);
const normalizedSchedule = this.normalizeSchedule(scheduleInput);

return this.tasks.create({
  ...input,
  ...normalizedSchedule,
  title,
});
```

In `updateSchedule()`, validate before normalizing and writing:

```ts
this.validateSchedule(input);
const normalizedSchedule = this.normalizeSchedule(input);
const updated = this.tasks.updateSchedule(normalizedSchedule);
```

- [ ] **Step 7: Add batch methods**

Add to `TasksService`:

```ts
private assertBatchTasksExist(userId: number, taskIds: number[]): void {
  this.assertPositiveTaskIds(taskIds);
  for (const taskId of taskIds) {
    const task = this.tasks.getById(taskId, userId);
    if (!task) {
      throw new AppError(404, 'Task not found');
    }
  }
}

batchScheduleDate(input: {userId: number; taskIds: number[]; plannedDate: string}) {
  this.assertBatchTasksExist(input.userId, input.taskIds);
  const updates: BatchTaskScheduleInput[] = input.taskIds.map((taskId) => this.normalizeSchedule({
    taskId,
    userId: input.userId,
    plannedDate: input.plannedDate,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  }));
  updates.forEach((update) => this.validateSchedule(update));
  return this.tasks.batchUpdateSchedules(updates);
}

batchUnschedule(input: {userId: number; taskIds: number[]}) {
  this.assertBatchTasksExist(input.userId, input.taskIds);
  const updates: BatchTaskScheduleInput[] = input.taskIds.map((taskId) => this.normalizeSchedule({
    taskId,
    userId: input.userId,
    plannedDate: undefined,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  }));
  return this.tasks.batchUpdateSchedules(updates);
}
```

- [ ] **Step 8: Run service tests**

Run:

```bash
npm test -- server/modules/tasks/tasks.service.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

```bash
git add server/modules/tasks/repository.ts server/modules/tasks/service.ts server/modules/tasks/tasks.service.test.ts
git commit -m "feat: add task batch scheduling service contract"
```

---

### Task 4: JSON Task Repository

**Files:**
- Modify: `server/storage/json/repositories/taskJsonRepository.ts`
- Modify: `server/storage/json/repositories/taskJsonRepository.test.ts`

- [ ] **Step 1: Add failing JSON repository tests**

Append to `server/storage/json/repositories/taskJsonRepository.test.ts`:

```ts
it('creates and filters unscheduled json tasks', () => {
  const filePath = createTempFilePath();
  const store = new JsonFileStore(filePath);
  const repository = new TaskJsonRepository(store);

  const unscheduled = repository.create({
    userId: 1,
    categoryId: 1,
    title: '  未排期  ',
    plannedDate: undefined,
    allDay: true,
  });
  repository.create({
    userId: 1,
    categoryId: 1,
    title: '已排期',
    plannedDate: '2026-06-06',
    allDay: true,
  });

  expect(unscheduled).toMatchObject({
    title: '未排期',
    plannedDate: undefined,
    allDay: true,
  });
  expect(repository.listByFilters({userId: 1}).map((task) => task.title)).toEqual(['未排期', '已排期']);
  expect(repository.listByFilters({userId: 1, scheduled: 'unscheduled'}).map((task) => task.title)).toEqual(['未排期']);
  expect(repository.listByFilters({userId: 1, plannedDate: '2026-06-06'}).map((task) => task.title)).toEqual(['已排期']);
});

it('filters json all-day-without-time tasks and query text', () => {
  const filePath = createTempFilePath();
  const store = new JsonFileStore(filePath);
  const schema = createEmptyDatabaseSchema();
  schema.tasks = [
    {id: 1, userId: 1, categoryId: 1, title: '写周报', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '1', updatedAt: '1'},
    {id: 2, userId: 1, categoryId: 1, title: '周报跨天', plannedDate: '2026-06-06', plannedEndDate: '2026-06-07', allDay: true, status: 'TODO', createdAt: '2', updatedAt: '2'},
    {id: 3, userId: 1, categoryId: 1, title: '会议周报', plannedDate: '2026-06-06', startAt: '2026-06-06T09:00:00.000', endAt: '2026-06-06T10:00:00.000', allDay: false, status: 'TODO', createdAt: '3', updatedAt: '3'},
  ];
  schema.sequences.tasks = 3;
  store.write(schema);

  const repository = new TaskJsonRepository(store);

  expect(repository.listByFilters({
    userId: 1,
    scheduled: 'all-day-without-time',
    dateFrom: '2026-06-01',
    dateTo: '2026-06-07',
    query: '周报',
  }).map((task) => task.title)).toEqual(['写周报']);
});

it('batch updates json schedules in a single store update', () => {
  const filePath = createTempFilePath();
  const store = new JsonFileStore(filePath);
  const repository = new TaskJsonRepository(store);
  const first = repository.create({userId: 1, categoryId: 1, title: 'A', plannedDate: undefined, allDay: true});
  const second = repository.create({userId: 1, categoryId: 1, title: 'B', plannedDate: undefined, allDay: true});

  const updated = repository.batchUpdateSchedules([
    {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
    {taskId: second.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
  ]);

  expect(updated.map((task) => task.plannedDate)).toEqual(['2026-06-08', '2026-06-08']);
});

it('does not partially update json schedules when a batch task is missing', () => {
  const filePath = createTempFilePath();
  const store = new JsonFileStore(filePath);
  const repository = new TaskJsonRepository(store);
  const first = repository.create({userId: 1, categoryId: 1, title: 'A', plannedDate: undefined, allDay: true});

  expect(() => repository.batchUpdateSchedules([
    {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
    {taskId: 999, userId: 1, plannedDate: '2026-06-08', allDay: true},
  ])).toThrow('Task not found');

  expect(repository.getById(first.id, 1)?.plannedDate).toBeUndefined();
});
```

- [ ] **Step 2: Run JSON repository tests and verify RED**

Run:

```bash
npm test -- server/storage/json/repositories/taskJsonRepository.test.ts
```

Expected: FAIL because filters and batch updates do not exist.

- [ ] **Step 3: Add JSON filter helpers**

In `server/storage/json/repositories/taskJsonRepository.ts`, add:

```ts
function matchesScheduledFilter(task: Task, scheduled: TaskFilters['scheduled']): boolean {
  if (!scheduled) return true;
  if (scheduled === 'unscheduled') return !task.plannedDate;
  if (scheduled === 'scheduled') return Boolean(task.plannedDate);
  return Boolean(task.plannedDate && task.allDay && !task.plannedEndDate && !task.startAt && !task.endAt);
}

function matchesQuery(task: Task, query: string | undefined): boolean {
  if (!query) return true;
  return task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function applyScheduleToTask(task: Task, input: UpdateTaskScheduleInput): void {
  task.plannedDate = input.plannedDate;
  task.plannedEndDate = input.plannedDate && input.allDay ? input.plannedEndDate : undefined;
  task.startAt = input.plannedDate && !input.allDay ? input.startAt : undefined;
  task.endAt = input.plannedDate && !input.allDay ? input.endAt : undefined;
  task.allDay = input.plannedDate ? input.allDay : true;
  task.updatedAt = new Date().toISOString();
}
```

- [ ] **Step 4: Update JSON repository implementation**

In `listByFilters`, add the new filters after user/date/category checks:

```ts
if (!matchesScheduledFilter(task, filters.scheduled)) return false;
if (!matchesQuery(task, filters.query)) return false;
```

In `create`, set schedule fields with optional `plannedDate`:

```ts
plannedDate: input.plannedDate,
plannedEndDate: input.plannedDate && (input.allDay ?? true) ? input.plannedEndDate : undefined,
startAt: input.plannedDate && input.allDay === false ? input.startAt : undefined,
endAt: input.plannedDate && input.allDay === false ? input.endAt : undefined,
allDay: input.plannedDate ? input.allDay ?? true : true,
```

In `updateSchedule`, replace manual assignment with `applyScheduleToTask(task, input)`.

Add `batchUpdateSchedules`:

```ts
batchUpdateSchedules(inputs: UpdateTaskScheduleInput[]): Task[] {
  return this.store.update((data) => {
    const targets = inputs.map((input) => {
      const task = data.tasks.find((item) => item.id === input.taskId && item.userId === input.userId);
      if (!task) {
        throw new Error('Task not found');
      }
      return {task, input};
    });

    for (const {task, input} of targets) {
      applyScheduleToTask(task, input);
    }

    return targets.map(({task}) => toCanonicalTask(task));
  });
}
```

This method must not mutate the first task before all targets are found.

- [ ] **Step 5: Run JSON repository tests**

Run:

```bash
npm test -- server/storage/json/repositories/taskJsonRepository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add server/storage/json/repositories/taskJsonRepository.ts server/storage/json/repositories/taskJsonRepository.test.ts
git commit -m "feat: persist unscheduled tasks in json storage"
```

---

### Task 5: SQLite Migration, Mapper, and Repository

**Files:**
- Modify: `server/storage/sqlite/migrations.ts`
- Modify: `server/storage/sqlite/sqliteClient.test.ts`
- Modify: `server/storage/sqlite/repositories/rowMappers.ts`
- Modify: `server/storage/sqlite/repositories/rowMappers.test.ts`
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.ts`
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`

- [ ] **Step 1: Add failing SQLite tests**

Append to `server/storage/sqlite/repositories/rowMappers.test.ts`:

```ts
it('maps nullable planned_date as an unscheduled task', () => {
  expect(mapTaskRow({
    id: 6,
    user_id: 1,
    category_id: 1,
    title: '未安排',
    planned_date: null,
    planned_end_date: '2026-06-08',
    start_at: '2026-06-06T09:00:00.000',
    end_at: '2026-06-06T10:00:00.000',
    all_day: 0,
    status: 'TODO',
    created_at: '2026-06-05T00:00:00.000Z',
    updated_at: '2026-06-05T00:00:00.000Z',
  })).toMatchObject({
    plannedDate: undefined,
    plannedEndDate: undefined,
    startAt: undefined,
    endAt: undefined,
    allDay: true,
  });
});
```

Append to `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`:

```ts
it('allows planned_date to be null after migrations', () => {
  const info = db.prepare('pragma table_info(tasks)').all() as Array<{name: string; notnull: number}>;
  expect(info.find((column) => column.name === 'planned_date')?.notnull).toBe(0);
});

it('clears residual schedule columns when creating or updating unscheduled sqlite tasks', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  const task = tasks.create({
    userId: 1,
    categoryId: category.id,
    title: '未安排',
    plannedDate: undefined,
    plannedEndDate: '2026-06-08',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });

  expect(db.prepare('select planned_date, planned_end_date, start_at, end_at, all_day from tasks where id = ?').get(task.id)).toEqual({
    planned_date: null,
    planned_end_date: null,
    start_at: null,
    end_at: null,
    all_day: 1,
  });

  tasks.updateSchedule({
    taskId: task.id,
    userId: 1,
    plannedDate: undefined,
    plannedEndDate: '2026-06-09',
    startAt: '2026-06-09T09:00:00.000',
    endAt: '2026-06-09T10:00:00.000',
    allDay: false,
  });

  expect(db.prepare('select planned_date, planned_end_date, start_at, end_at, all_day from tasks where id = ?').get(task.id)).toEqual({
    planned_date: null,
    planned_end_date: null,
    start_at: null,
    end_at: null,
    all_day: 1,
  });
});

it('creates, filters, and unschedules sqlite tasks', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  const unscheduled = tasks.create({userId: 1, categoryId: category.id, title: '未安排', plannedDate: undefined, allDay: true});
  const scheduled = tasks.create({userId: 1, categoryId: category.id, title: '已安排', plannedDate: '2026-06-06', allDay: true});

  expect(unscheduled.plannedDate).toBeUndefined();
  expect(tasks.listByFilters({userId: 1}).map((task) => task.title)).toEqual(['未安排', '已安排']);
  expect(tasks.listByFilters({userId: 1, scheduled: 'unscheduled'}).map((task) => task.title)).toEqual(['未安排']);
  expect(tasks.listByFilters({userId: 1, plannedDate: '2026-06-06'}).map((task) => task.title)).toEqual(['已安排']);

  const updated = tasks.updateSchedule({taskId: scheduled.id, userId: 1, plannedDate: undefined, allDay: true});
  expect(updated?.plannedDate).toBeUndefined();
});

it('filters sqlite all-day-without-time tasks and escapes query wildcards', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  tasks.create({userId: 1, categoryId: category.id, title: '周报_真实', plannedDate: '2026-06-06', allDay: true});
  tasks.create({userId: 1, categoryId: category.id, title: '周报X真实', plannedDate: '2026-06-06', allDay: true});
  tasks.create({userId: 1, categoryId: category.id, title: '周报跨天', plannedDate: '2026-06-06', plannedEndDate: '2026-06-07', allDay: true});

  expect(tasks.listByFilters({
    userId: 1,
    scheduled: 'all-day-without-time',
    dateFrom: '2026-06-01',
    dateTo: '2026-06-07',
    query: '周报_',
  }).map((task) => task.title)).toEqual(['周报_真实']);
});

it('batch updates sqlite schedules atomically', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  const first = tasks.create({userId: 1, categoryId: category.id, title: 'A', plannedDate: undefined, allDay: true});
  const second = tasks.create({userId: 1, categoryId: category.id, title: 'B', plannedDate: undefined, allDay: true});

  const updated = tasks.batchUpdateSchedules([
    {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
    {taskId: second.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
  ]);

  expect(updated.map((task) => task.plannedDate)).toEqual(['2026-06-08', '2026-06-08']);
});

it('rolls back sqlite batch schedule updates when a task is missing', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  const first = tasks.create({userId: 1, categoryId: category.id, title: 'A', plannedDate: undefined, allDay: true});

  expect(() => tasks.batchUpdateSchedules([
    {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
    {taskId: 999, userId: 1, plannedDate: '2026-06-08', allDay: true},
  ])).toThrow('Task not found');

  expect(tasks.getById(first.id, 1)?.plannedDate).toBeUndefined();
});
```

In `server/storage/sqlite/sqliteClient.test.ts`, update the idempotent migration expectation from:

```ts
expect(migrations).toEqual([{version: 1}, {version: 2}, {version: 3}]);
```

to:

```ts
expect(migrations).toEqual([{version: 1}, {version: 2}, {version: 3}, {version: 4}]);
```

Add this migration regression test to `server/storage/sqlite/sqliteClient.test.ts`:

```ts
it('migrates v3 task tables with execution sessions to nullable planned_date', () => {
  sqliteFile = createTestSqliteFile('plantodo-sqlite-v3-upgrade');
  const setup = openSqliteClient(sqliteFile.filePath);
  setup.prepare(
    'insert into categories (id, user_id, name, color, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
  ).run(1, 1, '工作', '#ef4444', 1, '2026-06-06T00:00:00.000Z', '2026-06-06T00:00:00.000Z');
  setup.prepare(
    'insert into tasks (id, user_id, category_id, title, planned_date, status, created_at, updated_at, all_day) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(1, 1, 1, '写方案', '2026-06-06', 'TODO', '2026-06-06T00:00:00.000Z', '2026-06-06T00:00:00.000Z', 1);
  setup.prepare(
    'insert into task_execution_sessions (id, task_id, user_id, started_at, status, created_at) values (?, ?, ?, ?, ?, ?)',
  ).run(1, 1, 1, '2026-06-06T09:00:00.000Z', 'COMPLETED', '2026-06-06T09:00:00.000Z');
  setup.prepare('delete from schema_migrations where version = 4').run();
  setup.close();

  const migrated = openSqliteClient(sqliteFile.filePath);
  const info = migrated.prepare('pragma table_info(tasks)').all() as Array<{name: string; notnull: number}>;
  expect(info.find((column) => column.name === 'planned_date')?.notnull).toBe(0);
  expect(migrated.prepare('select task_id from task_execution_sessions where id = 1').get()).toEqual({task_id: 1});
  expect(migrated.pragma('foreign_key_check')).toEqual([]);
  migrated.close();
});
```

This test creates a fully migrated database, removes only the V4 migration marker, then reopens the client to simulate a pre-V4 database with an existing child row. It would fail if V4 drops `tasks` while foreign keys are enforced.

- [ ] **Step 2: Run SQLite tests and verify RED**

Run:

```bash
npm test -- server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: FAIL because `planned_date` is non-null and mapper/repository do not support null/batch filters.

- [ ] **Step 3: Add foreign-key-safe V4 migration**

In `server/storage/sqlite/migrations.ts`, first change the migration type and runner to support custom non-outer-transaction migrations:

```ts
interface Migration {
  version: number;
  name: string;
  sql?: string;
  apply?: (db: Database.Database) => void;
  transaction?: boolean;
}
```

Add this helper below the migration list:

```ts
function applyMigrationSql(db: Database.Database, migration: Migration): void {
  if (migration.sql) {
    db.exec(migration.sql);
    return;
  }
  migration.apply?.(db);
}
```

Replace the per-migration application block in `runMigrations()` with:

```ts
const applyAndRecord = () => {
  applyMigrationSql(db, migration);
  db.prepare('insert into schema_migrations (version, name, executed_at) values (?, ?, ?)').run(
    migration.version,
    migration.name,
    new Date().toISOString(),
  );
};

if (migration.transaction === false) {
  applyAndRecord();
} else {
  db.transaction(applyAndRecord)();
}
```

Then append a migration after version 3:

```ts
{
  version: 4,
  name: 'nullable_task_planned_date',
  transaction: false,
  apply(db) {
    db.pragma('foreign_keys = OFF');
    try {
      db.exec('begin');
      db.exec(`
        create table tasks_new (
          id integer primary key,
          user_id integer not null,
          category_id integer not null,
          title text not null,
          planned_date text,
          status text not null,
          created_at text not null,
          updated_at text not null,
          planned_end_date text,
          start_at text,
          end_at text,
          all_day integer not null default 1,
          foreign key (user_id) references users(id),
          foreign key (category_id) references categories(id)
        );

        insert into tasks_new (
          id, user_id, category_id, title, planned_date, status, created_at, updated_at,
          planned_end_date, start_at, end_at, all_day
        )
        select
          id, user_id, category_id, title, planned_date, status, created_at, updated_at,
          planned_end_date, start_at, end_at, all_day
        from tasks;

        drop table tasks;
        alter table tasks_new rename to tasks;

        create index if not exists idx_tasks_user_date on tasks(user_id, planned_date);
        create index if not exists idx_tasks_user_status on tasks(user_id, status);
        create index if not exists idx_tasks_user_category on tasks(user_id, category_id);
        create index if not exists idx_tasks_user_planned_end_date on tasks(user_id, planned_end_date);
        create index if not exists idx_tasks_user_start_at on tasks(user_id, start_at);
      `);
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (violations.length > 0) {
        throw new Error('SQLite foreign key check failed after nullable planned_date migration');
      }
      db.exec('commit');
    } catch (error) {
      db.exec('rollback');
      throw error;
    } finally {
      db.pragma('foreign_keys = ON');
    }
  },
},
```

- [ ] **Step 4: Update row mapper**

In `server/storage/sqlite/repositories/rowMappers.ts`, change:

```ts
planned_date: string;
```

to:

```ts
planned_date: string | null;
```

Replace `mapTaskRow` with:

```ts
export function mapTaskRow(row: TaskRow): Task {
  if (!row.planned_date) {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      title: row.title,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
      status: row.status as TaskStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const allDay = row.all_day !== 0;
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    plannedDate: row.planned_date,
    plannedEndDate: allDay ? row.planned_end_date ?? undefined : undefined,
    startAt: allDay ? undefined : row.start_at ?? undefined,
    endAt: allDay ? undefined : row.end_at ?? undefined,
    allDay,
    status: row.status as TaskStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 5: Add SQLite repository helpers**

In `server/storage/sqlite/repositories/taskSqliteRepository.ts`, add:

```ts
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
```

Inside `listByFilters`, add SQL clauses:

```ts
if (filters.scheduled === 'unscheduled') {
  clauses.push('planned_date is null');
} else if (filters.scheduled === 'scheduled') {
  clauses.push('planned_date is not null');
} else if (filters.scheduled === 'all-day-without-time') {
  clauses.push('planned_date is not null');
  clauses.push('all_day = 1');
  clauses.push('planned_end_date is null');
  clauses.push('start_at is null');
  clauses.push('end_at is null');
}

if (filters.query) {
  clauses.push('lower(title) like ? escape \'\\\'');
  values.push(`%${escapeLike(filters.query.toLocaleLowerCase())}%`);
}
```

In the existing date-range SQL clause, add `planned_date is not null` inside the all-day branch:

```sql
all_day = 1
and planned_date is not null
and planned_date <= ?
and coalesce(planned_end_date, planned_date) >= ?
```

- [ ] **Step 6: Update SQLite writes and batch transaction**

In `create()` and `updateSchedule()`, pass `input.plannedDate ?? null` for `planned_date`, and clear all schedule fields when `plannedDate` is missing:

```ts
input.plannedDate ?? null,
input.plannedDate && input.allDay ? input.plannedEndDate ?? null : null,
input.plannedDate && input.allDay === false ? input.startAt ?? null : null,
input.plannedDate && input.allDay === false ? input.endAt ?? null : null,
input.plannedDate && input.allDay === false ? 0 : 1,
```

Add:

```ts
batchUpdateSchedules(inputs: UpdateTaskScheduleInput[]): Task[] {
  const updateSchedules = this.db.transaction(() => {
    const updated: Task[] = [];
    for (const input of inputs) {
      const task = this.updateSchedule(input);
      if (!task) {
        throw new Error('Task not found');
      }
      updated.push(task);
    }
    return updated;
  });

  return updateSchedules();
}
```

This is acceptable because `updateSchedule()` participates in the outer better-sqlite3 transaction.

- [ ] **Step 7: Run SQLite tests**

Run:

```bash
npm test -- server/storage/sqlite/sqliteClient.test.ts server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add server/storage/sqlite/migrations.ts server/storage/sqlite/sqliteClient.test.ts server/storage/sqlite/repositories/rowMappers.ts server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
git commit -m "feat: persist unscheduled tasks in sqlite storage"
```

---

### Task 6: HTTP Routes and Frontend API Contract

**Files:**
- Modify: `server/modules/tasks/routes.ts`
- Create: `server/modules/tasks/routes.test.ts`
- Modify: `src/modules/tasks/api/tasksApi.ts`
- Modify: `src/modules/tasks/api/tasksApi.test.ts`
- Modify: `src/modules/calendar/api/calendarApi.ts`

- [ ] **Step 1: Add failing frontend API tests**

Append to `src/modules/tasks/api/tasksApi.test.ts`:

```ts
it('queries tasks by scheduled state and search query', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.getTasks({
    scheduled: 'all-day-without-time',
    dateFrom: '2026-06-01',
    dateTo: '2026-06-07',
    query: '周报',
  });

  expect(fetch).toHaveBeenCalledWith(
    '/api/tasks?dateFrom=2026-06-01&dateTo=2026-06-07&scheduled=all-day-without-time&query=%E5%91%A8%E6%8A%A5',
    expect.any(Object),
  );
});

it('creates an unscheduled task without plannedDate', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.createTask({title: '收集资料', categoryId: 1});

  expect(fetch).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({title: '收集资料', categoryId: 1}),
  }));
});

it('unschedules a task with null plannedDate', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.updateTaskSchedule(1, {plannedDate: null, allDay: true});

  expect(fetch).toHaveBeenCalledWith('/api/tasks/1/schedule', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({plannedDate: null, allDay: true}),
  }));
});

it('calls batch schedule endpoints', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.batchScheduleDate({taskIds: [1, 2], plannedDate: '2026-06-06'});
  await tasksApi.batchUnschedule({taskIds: [1, 2]});

  expect(fetch).toHaveBeenNthCalledWith(1, '/api/tasks/batch-schedule', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({taskIds: [1, 2], plannedDate: '2026-06-06'}),
  }));
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/tasks/batch-unschedule', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({taskIds: [1, 2]}),
  }));
});
```

- [ ] **Step 2: Run API tests and verify RED**

Run:

```bash
npm test -- src/modules/tasks/api/tasksApi.test.ts
```

Expected: FAIL because frontend API types/methods do not exist.

- [ ] **Step 3: Add backend route tests**

Create `server/modules/tasks/routes.test.ts`:

```ts
import express from 'express';
import type {Server} from 'node:http';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {buildTaskRoutes} from './routes';

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

function buildService(overrides = {}) {
  return {
    list: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    updateSchedule: vi.fn(() => ({id: 1})),
    batchScheduleDate: vi.fn(() => [{id: 1}, {id: 2}]),
    batchUnschedule: vi.fn(() => [{id: 1}, {id: 2}]),
    delete: vi.fn(),
    ...overrides,
  };
}

async function request(service: ReturnType<typeof buildService>, path: string, body: unknown) {
  const app = express();
  app.use(express.json());
  app.use('/api', buildTaskRoutes(service as unknown as Parameters<typeof buildTaskRoutes>[0]));

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server!.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a port');
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
}

describe('task routes', () => {
  it('routes batch schedule to the static batch handler', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/batch-schedule', {
      taskIds: [1, 2],
      plannedDate: '2026-06-06',
    });

    expect(response.status).toBe(200);
    expect(service.batchScheduleDate).toHaveBeenCalledWith({
      userId: 1,
      taskIds: [1, 2],
      plannedDate: '2026-06-06',
    });
    expect(service.updateSchedule).not.toHaveBeenCalled();
  });

  it('routes batch unschedule to the static batch handler', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/batch-unschedule', {taskIds: [1, 2]});

    expect(response.status).toBe(200);
    expect(service.batchUnschedule).toHaveBeenCalledWith({userId: 1, taskIds: [1, 2]});
    expect(service.updateSchedule).not.toHaveBeenCalled();
  });

  it('routes single-task empty schedule body as unschedule', async () => {
    const service = buildService();

    const response = await request(service, '/api/tasks/1/schedule', {});

    expect(response.status).toBe(200);
    expect(service.updateSchedule).toHaveBeenCalledWith({
      taskId: 1,
      userId: 1,
      plannedDate: undefined,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
      allDay: true,
    });
  });
});
```

- [ ] **Step 4: Add route imports and static batch routes**

In `server/modules/tasks/routes.ts`, import:

```ts
parseBatchScheduleBody,
parseBatchUnscheduleBody,
```

Add these routes after the existing `router.post('/tasks', ...)` block and before `router.patch('/tasks/:id/status', ...)`:

```ts
router.patch('/tasks/batch-schedule', (req, res) => {
  try {
    const {userId} = getUserContext();
    const body = parseBatchScheduleBody(req.body);
    res.json(service.batchScheduleDate({userId, ...body}));
  } catch (error) {
    handleHttpError(res, error);
  }
});

router.patch('/tasks/batch-unschedule', (req, res) => {
  try {
    const {userId} = getUserContext();
    const body = parseBatchUnscheduleBody(req.body);
    res.json(service.batchUnschedule({userId, ...body}));
  } catch (error) {
    handleHttpError(res, error);
  }
});
```

- [ ] **Step 5: Update frontend task API types**

In `src/modules/tasks/api/tasksApi.ts`, add:

```ts
type ScheduledFilter = 'unscheduled' | 'scheduled' | 'all-day-without-time';

export interface TaskSchedulePayload {
  plannedDate?: string | null;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}
```

Extend `getTasks` filters with `scheduled?: ScheduledFilter; query?: string`, then append params:

```ts
if (filters?.scheduled) params.append('scheduled', filters.scheduled);
if (filters?.query) params.append('query', filters.query);
```

Change `createTask` planned date type:

```ts
createTask(task: {
  title: string;
  categoryId: number;
  plannedDate?: string | null;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}): Promise<Task> {
```

Change `updateTaskSchedule` to use `TaskSchedulePayload`.

Add:

```ts
batchScheduleDate(input: {taskIds: number[]; plannedDate: string}): Promise<Task[]> {
  return requestJson<Task[]>('/api/tasks/batch-schedule', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
},

batchUnschedule(input: {taskIds: number[]}): Promise<Task[]> {
  return requestJson<Task[]>('/api/tasks/batch-unschedule', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
},
```

- [ ] **Step 6: Align calendar API schedule payload**

In `src/modules/calendar/api/calendarApi.ts`, replace the local `TaskSchedulePayload` with an import:

```ts
import {tasksApi, type TaskSchedulePayload} from '../../tasks/api/tasksApi';
```

Remove the local `TaskSchedulePayload` interface. Keep `createCalendarTask(input: {title: string; categoryId: number; plannedDate: string; allDay: true})` scheduled-only.

- [ ] **Step 7: Run API and route tests**

Run:

```bash
npm test -- server/modules/tasks/routes.test.ts src/modules/tasks/api/tasksApi.test.ts
npm run lint
```

Expected: tests PASS; lint may still expose frontend `plannedDate` assumptions, handled in Task 8.

- [ ] **Step 8: Commit Task 6**

```bash
git add server/modules/tasks/routes.ts server/modules/tasks/routes.test.ts src/modules/tasks/api/tasksApi.ts src/modules/tasks/api/tasksApi.test.ts src/modules/calendar/api/calendarApi.ts
git commit -m "feat: expose task scheduling batch api"
```

---

### Task 7: JSON to SQLite Import

**Files:**
- Modify: `scripts/importJsonToSqlite.ts`
- Modify: `scripts/importJsonToSqlite.test.ts`

- [ ] **Step 1: Add failing import test**

Append to `scripts/importJsonToSqlite.test.ts`:

```ts
it('imports unscheduled json tasks with nullable sqlite planned_date', () => {
  const {jsonPath, sqlitePath} = createTestFiles();
  fs.writeFileSync(jsonPath, JSON.stringify({
    users: [{id: 1, username: 'demo', displayName: 'Demo', createdAt: '2026-06-06T00:00:00.000Z'}],
    categories: [{id: 1, userId: 1, name: '工作', color: '#000000', sortOrder: 1, createdAt: '2026-06-06T00:00:00.000Z', updatedAt: '2026-06-06T00:00:00.000Z'}],
    tasks: [{
      id: 1,
      userId: 1,
      categoryId: 1,
      title: '未安排',
      plannedDate: null,
      plannedEndDate: '2026-06-08',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
      status: 'TODO',
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:00:00.000Z',
    }],
    sequences: {categories: 1, tasks: 1, taskExecutionSessions: 0, dailyReports: 0, weeklyReviews: 0},
  }));

  importJsonToSqlite({jsonPath, sqlitePath});

  const db = openSqliteClient(sqlitePath);
  try {
    expect(db.prepare('select planned_date, planned_end_date, start_at, end_at, all_day from tasks where id = 1').get()).toEqual({
      planned_date: null,
      planned_end_date: null,
      start_at: null,
      end_at: null,
      all_day: 1,
    });
  } finally {
    db.close();
  }
});
```

- [ ] **Step 2: Run import tests and verify RED**

Run:

```bash
npm test -- scripts/importJsonToSqlite.test.ts
```

Expected: FAIL because `JsonTask.plannedDate` only accepts string and import writes schedule fields even when plannedDate is null.

- [ ] **Step 3: Update import task type**

In `scripts/importJsonToSqlite.ts`, change:

```ts
plannedDate: string;
```

to:

```ts
plannedDate?: string | null;
```

- [ ] **Step 4: Normalize imported task schedule fields**

Inside the task import loop, before the insert:

```ts
const plannedDate = task.plannedDate ?? null;
const allDay = plannedDate ? task.allDay !== false : true;
const plannedEndDate = plannedDate && allDay ? task.plannedEndDate ?? null : null;
const startAt = plannedDate && !allDay ? task.startAt ?? null : null;
const endAt = plannedDate && !allDay ? task.endAt ?? null : null;
```

Then replace insert values:

```ts
plannedDate,
plannedEndDate,
startAt,
endAt,
allDay ? 1 : 0,
```

- [ ] **Step 5: Run import tests**

Run:

```bash
npm test -- scripts/importJsonToSqlite.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add scripts/importJsonToSqlite.ts scripts/importJsonToSqlite.test.ts
git commit -m "feat: import unscheduled json tasks to sqlite"
```

---

### Task 8: Minimal Frontend Compatibility

**Files:**
- Modify: `src/modules/tasks/controllers/useTasksController.ts`
- Modify: `src/modules/tasks/controllers/taskFilters.test.ts`
- Modify: `src/modules/tasks/components/TasksPanel.tsx`
- Modify: `src/modules/tasks/components/TasksPanel.test.tsx`
- Modify: `src/modules/calendar/controllers/calendarLayout.ts`
- Modify: `src/modules/calendar/controllers/calendarLayout.test.ts`
- Modify: `src/modules/calendar/components/WeekTimelineView.tsx`
- Modify: `src/modules/calendar/components/MonthCalendarView.tsx`
- Modify: `src/modules/calendar/components/MonthCalendarView.test.tsx`

- [ ] **Step 1: Add failing frontend compatibility tests**

Append to `src/modules/tasks/controllers/taskFilters.test.ts`:

```ts
it('excludes unscheduled tasks from date scoped task filters', () => {
  const scheduled = {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '已安排',
    plannedDate: '2026-06-05',
    allDay: true,
    status: 'TODO' as const,
    createdAt: '',
    updatedAt: '',
  };
  const unscheduled = {...scheduled, id: 99, title: '未安排', plannedDate: undefined};

  expect(filterTasks([unscheduled, scheduled], {
    category: 'all',
    status: 'all',
    dateScope: 'today',
    selectedDate: '2026-06-05',
  }).map((task) => task.title)).not.toContain('未安排');

  expect(filterTasks([unscheduled, scheduled], {
    category: 'all',
    status: 'all',
    dateScope: 'seven-days',
    selectedDate: '2026-06-05',
  }).map((task) => task.title)).not.toContain('未安排');

  expect(filterTasks([unscheduled, scheduled], {
    category: 'all',
    status: 'all',
    dateScope: 'all',
    selectedDate: '2026-06-05',
  }).map((task) => task.title)).toContain('未安排');
});
```

Append to `src/modules/calendar/components/MonthCalendarView.test.tsx`:

```tsx
it('ignores unscheduled tasks if malformed date groups include them', () => {
  render(
    <MonthCalendarView
      anchorDate="2026-06-06"
      tasksByDate={{'2026-06-06': [{...task, id: 99, title: '未安排', plannedDate: undefined}]}}
      categories={categories}
      onCreateDateTask={vi.fn().mockResolvedValue(undefined)}
      onScheduleDate={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(screen.queryByText('未安排')).not.toBeInTheDocument();
});
```

Append to `src/modules/calendar/controllers/calendarLayout.test.ts`:

```ts
it('does not group unscheduled tasks into calendar dates', () => {
  const grouped = groupTasksByDate([
    {...baseTask, id: 99, title: '未安排', plannedDate: undefined},
  ], '2026-06-01', '2026-06-07');

  expect(Object.values(grouped).flat()).toEqual([]);
});
```

Append to `src/modules/tasks/components/TasksPanel.test.tsx`:

```tsx
it('shows unscheduled tasks as 未安排', () => {
  renderPanel({
    filteredTaskItems: [{...baseTasks[0], id: 99, title: '未安排任务', plannedDate: undefined}],
  });

  expect(screen.getByText('未安排')).toBeInTheDocument();
});
```

If `TasksPanel.test.tsx` does not have `renderPanel`, first extract the repeated render setup into:

```tsx
type TasksPanelProps = Parameters<typeof TasksPanel>[0];

function renderPanel(overrides: Partial<TasksPanelProps> = {}) {
  const props: TasksPanelProps = {
    styleContext: {primary: '#2563eb', primaryLight: '#dbeafe', secondary: '#64748b'},
    categories: baseCategories,
    allTasks: baseTasks,
    filteredTaskItems: baseTasks,
    taskFormTitle: '',
    taskFormCategory: 1,
    taskFormDate: '2026-06-05',
    taskFilterCategory: 'all',
    taskFilterStatus: 'all',
    taskFilterDateScope: 'today',
    setTaskFormTitle: vi.fn(),
    setTaskFormCategory: vi.fn(),
    setTaskFormDate: vi.fn(),
    setTaskFilterCategory: vi.fn(),
    setTaskFilterStatus: vi.fn(),
    setTaskFilterDateScope: vi.fn(),
    handleCreateTask: vi.fn(),
    handleUpdateTaskStatus: vi.fn(),
    handleStartSession: vi.fn(),
    handleDeleteTask: vi.fn(),
    ...overrides,
  };

  return render(<TasksPanel {...props} />);
}
```

- [ ] **Step 2: Run frontend compatibility tests and verify RED**

Run:

```bash
npm test -- src/modules/tasks/controllers/taskFilters.test.ts src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/components/MonthCalendarView.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
```

Expected: FAIL because comparisons and display assume `plannedDate` exists.

- [ ] **Step 3: Guard task date filters**

In `src/modules/tasks/controllers/useTasksController.ts`, update date filters:

```ts
if (filters.dateScope === 'today') {
  return task.plannedDate === filters.selectedDate;
}

if (filters.dateScope === 'seven-days') {
  if (!task.plannedDate) {
    return false;
  }
  const limit = addIsoDateDays(filters.selectedDate, 7);
  return task.plannedDate >= filters.selectedDate && task.plannedDate <= limit;
}
```

The `today` equality is safe with `undefined`; the seven-day range must explicitly guard.

- [ ] **Step 4: Display unscheduled label**

In `src/modules/tasks/components/TasksPanel.tsx`, replace:

```tsx
{task.plannedDate}
```

with:

```tsx
{task.plannedDate ?? '未安排'}
```

- [ ] **Step 5: Guard calendar grouping**

In `src/modules/calendar/controllers/calendarLayout.ts`, `taskIntersectsDateRange()` will already return false for unscheduled tasks. Add explicit guards before computing visible ranges to avoid future unsafe edits:

```ts
if (!task.plannedDate) {
  continue;
}
```

inside `groupTasksByDate()` after `taskIntersectsDateRange()`.

At the start of `segmentAllDayTask()`, add an invariant guard:

```ts
if (!canonical.plannedDate) {
  throw new Error('Cannot segment unscheduled task');
}
```

In `src/modules/calendar/components/MonthCalendarView.tsx`, filter malformed unscheduled tasks before rendering:

```tsx
{(tasksByDate[day.isoDate] ?? []).filter((task) => task.plannedDate).slice(0, 4).map((task) => {
```

In `src/modules/calendar/components/WeekTimelineView.tsx`, strengthen the timed-task predicate so `plannedDate` is narrowed before `setResizeState()`:

```ts
const timedTasks = (tasksByDate[day.isoDate] ?? [])
  .filter((task): task is Task & {plannedDate: string; startAt: string; endAt: string} => {
    return !task.allDay && Boolean(task.plannedDate && task.startAt && task.endAt);
  });
```

This keeps `plannedDate: task.plannedDate` assignable to `ResizeState.plannedDate: string` without using `task.plannedDate!`.

- [ ] **Step 6: Run frontend compatibility tests**

Run:

```bash
npm test -- src/modules/tasks/controllers/taskFilters.test.ts src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/components/MonthCalendarView.test.tsx src/modules/tasks/components/TasksPanel.test.tsx
npm run lint
```

Expected: tests PASS and lint PASS or only reveal remaining optional `plannedDate` assumptions. Fix remaining assumptions by guarding, not by using non-null assertions.

- [ ] **Step 7: Commit Task 8**

```bash
git add src/modules/tasks/controllers/useTasksController.ts src/modules/tasks/controllers/taskFilters.test.ts src/modules/tasks/components/TasksPanel.tsx src/modules/tasks/components/TasksPanel.test.tsx src/modules/calendar/controllers/calendarLayout.ts src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/MonthCalendarView.tsx src/modules/calendar/components/MonthCalendarView.test.tsx
git commit -m "fix: handle unscheduled tasks in frontend basics"
```

---

### Task 9: Full Verification and Phase 2.1a Commit Hygiene

**Files:**
- Review all files changed in Tasks 1-8.

- [ ] **Step 1: Search for unsafe plannedDate assumptions**

Run:

```bash
rg -n "plannedDate(\\.|: string| >=| <=|\\.slice|!|: task\\.plannedDate)" shared server src scripts --glob '*.{ts,tsx}'
```

Expected:

- No `plannedDate: string` remains in task create/update/domain contracts where unscheduled is valid.
- Calendar creation-specific types may still require `plannedDate: string`.
- No `task.plannedDate.slice(...)`, `task.plannedDate!`, or unguarded range comparison remains.

- [ ] **Step 2: Run targeted backend tests**

Run:

```bash
npm test -- shared/lib/schedule.test.ts server/modules/tasks/schemas.test.ts server/modules/tasks/tasks.service.test.ts server/modules/tasks/routes.test.ts server/storage/json/repositories/taskJsonRepository.test.ts server/storage/sqlite/sqliteClient.test.ts server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts scripts/importJsonToSqlite.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run targeted frontend tests**

Run:

```bash
npm test -- src/modules/tasks/api/tasksApi.test.ts src/modules/tasks/controllers/taskFilters.test.ts src/modules/tasks/components/TasksPanel.test.tsx src/modules/calendar/controllers/calendarLayout.test.ts src/modules/calendar/controllers/useCalendarController.test.ts src/modules/calendar/components/MonthCalendarView.test.tsx src/modules/calendar/components/CalendarPanel.test.tsx
```

Expected: PASS. Existing calendar timed-task movement tests must still prove `durationMinutes` is preserved and cross-midnight drops are rejected.

- [ ] **Step 4: Run full regression**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- server/modules/tasks/repository.ts server/modules/tasks/service.ts server/storage/sqlite/migrations.ts src/modules/tasks/api/tasksApi.ts
```

Expected:

- No scheduling sidebar UI files are created in Phase 2.1a.
- Batch APIs exist but no UI calls them yet except API tests.
- SQLite V4 migration only changes `tasks.planned_date` nullability via table rebuild and recreates indexes.

- [ ] **Step 6: Final commit if any verification-only fixes were made**

If Task 9 required additional code fixes:

```bash
git add shared/domain/entities.ts shared/lib/schedule.ts shared/lib/schedule.test.ts \
  server/modules/tasks/repository.ts server/modules/tasks/schemas.ts server/modules/tasks/schemas.test.ts \
  server/modules/tasks/service.ts server/modules/tasks/tasks.service.test.ts server/modules/tasks/routes.ts \
  server/modules/tasks/routes.test.ts \
  server/storage/json/repositories/taskJsonRepository.ts server/storage/json/repositories/taskJsonRepository.test.ts \
  server/storage/sqlite/migrations.ts server/storage/sqlite/sqliteClient.test.ts server/storage/sqlite/repositories/rowMappers.ts \
  server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.ts \
  server/storage/sqlite/repositories/taskSqliteRepository.test.ts scripts/importJsonToSqlite.ts \
  scripts/importJsonToSqlite.test.ts src/modules/tasks/api/tasksApi.ts src/modules/tasks/api/tasksApi.test.ts \
  src/modules/tasks/controllers/useTasksController.ts src/modules/tasks/controllers/taskFilters.test.ts \
  src/modules/tasks/components/TasksPanel.tsx src/modules/tasks/components/TasksPanel.test.tsx \
  src/modules/calendar/controllers/calendarLayout.ts src/modules/calendar/controllers/calendarLayout.test.ts \
  src/modules/calendar/components/WeekTimelineView.tsx src/modules/calendar/components/MonthCalendarView.tsx \
  src/modules/calendar/components/MonthCalendarView.test.tsx \
  src/modules/calendar/api/calendarApi.ts
git commit -m "fix: stabilize unscheduled task foundation"
```

If no additional fixes were needed, do not create an empty commit.

---

## Self-Review

### Spec Coverage

- `Task.plannedDate` optional: Task 1.
- API accepts omitted/null `plannedDate`: Task 2 and Task 6.
- Service normalizes unscheduled tasks to `allDay=true` with cleared schedule fields: Task 3.
- Batch schedule and unschedule atomic service/repository contract: Task 3, Task 4, Task 5, Task 6.
- Batch `taskIds` strict positive-integer validation in parser and service: Task 2 and Task 3.
- `scheduled` and `query` repository filters: Task 2, Task 4, Task 5, Task 6.
- SQLite V4 nullable `planned_date`, including foreign-key-safe table rebuild: Task 5.
- JSON compatibility: Task 4.
- JSON-to-SQLite import: Task 7.
- Minimal frontend safety around optional `plannedDate`, including week timeline resize and month view malformed data guards: Task 8.
- Reports/focus semantics: preserved through date-filter behavior and full regression in Task 9; unscheduled tasks do not match date filters, while focus can still use `getById`.

### Intentional Non-Coverage

- Scheduling sidebar UI is Phase 2.1b and later.
- Drag/drop payload changes are Phase 2.1c and later.
- Multi-select UI and batch action controls are Phase 2.1d.
- Embedded task-page calendar is Phase 2.2.

### Execution Notes

- Do not loosen the cross-day timed-task rule. The stale schema test must be corrected to match the spec.
- Do not put V4 `drop table tasks` inside the default migration transaction with foreign keys enabled. Existing focus sessions reference `tasks`.
- Do not implement batch updates by looping through the public HTTP/API one-task schedule method. Repository-level atomicity is required.
- Do not use `plannedDate!` to silence TypeScript. That hides the exact class of bug this phase is removing.
