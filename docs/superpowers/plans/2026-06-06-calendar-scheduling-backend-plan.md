# Calendar Scheduling Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立日历一期的后端排期底座：任务排期字段、日期范围查询、排期更新 API、专注记录范围查询，以及 JSON/SQLite 兼容存储。

**Architecture:** 日历不新增 `CalendarEvent` 领域模型，排期仍归属 `tasks` 模块。共享层提供日期和本地 datetime 的纯函数，service 负责业务校验，repository 负责持久化和范围查询，HTTP/API 层只做参数解析和装配。旧任务默认归一化为全天日期任务，保证今日执行、任务库、专注、日报、周报不被破坏。

**Tech Stack:** TypeScript, Express, Vitest, better-sqlite3, JSON file storage.

---

## Current State Check

当前代码状态决定了这份计划的起点：

- `shared/domain/entities.ts` 的 `Task` 还只有 `plannedDate`，没有 `plannedEndDate/startAt/endAt/allDay`。
- `server/modules/tasks/repository.ts` 的 `TaskFilters` 只支持 `plannedDate/status/categoryId`。
- `server/modules/tasks/schemas.ts` 只解析 `date`，没有 `dateFrom/dateTo` 和 schedule body。
- JSON/SQLite task repository 都没有排期字段、范围交集查询和 `updateSchedule`。
- `FocusSessionRepository` 已经有 `listByDateRange`，但 HTTP 和前端 API 只暴露单日查询。

执行本计划前先运行：

```bash
npm test
npm run lint
npm run build
```

如果这三条当前不通过，先修基线。不要在坏基线上叠加日历功能。

## File Structure

- Modify: `shared/domain/entities.ts` - 扩展 `Task` 排期字段。
- Create: `shared/lib/schedule.ts` - 任务排期归一化、范围交集、本地 datetime 工具。
- Create: `shared/lib/schedule.test.ts` - 共享排期工具测试。
- Modify: `server/modules/tasks/repository.ts` - 扩展任务查询和排期更新契约。
- Modify: `server/modules/tasks/schemas.ts` - 解析日期范围、创建任务排期字段、排期更新 body。
- Modify: `server/modules/tasks/schemas.test.ts` - 覆盖 query/body 校验。
- Modify: `server/modules/tasks/service.ts` - 创建任务兼容排期字段，新增 `updateSchedule` 校验。
- Modify: `server/modules/tasks/tasks.service.test.ts` - 覆盖排期业务规则。
- Modify: `server/modules/tasks/routes.ts` - 新增 `PATCH /api/tasks/:id/schedule`，扩展范围查询。
- Modify: `server/storage/json/repositories/taskJsonRepository.ts` - 旧数据归一化、新字段读写、范围查询、排期更新。
- Modify: `server/storage/json/repositories/taskJsonRepository.test.ts` - 覆盖 JSON 存储兼容性。
- Modify: `server/storage/sqlite/migrations.ts` - 新增 version 3 排期字段 migration。
- Modify: `server/storage/sqlite/repositories/rowMappers.ts` - 映射新字段。
- Modify: `server/storage/sqlite/repositories/rowMappers.test.ts` - 覆盖新字段映射。
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.ts` - 新字段 insert/query/update。
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts` - 覆盖 SQLite migration、查询、更新。
- Modify: `scripts/importJsonToSqlite.ts` - JSON 导入 SQLite 时映射排期字段。
- Modify: `scripts/importJsonToSqlite.test.ts` - 覆盖旧 JSON 和新字段导入。
- Modify: `server/modules/focus/schemas.ts` - 解析 `dateFrom/dateTo`。
- Modify: `server/modules/focus/schemas.test.ts` - 覆盖单日、范围、冲突参数。
- Modify: `server/modules/focus/service.ts` - 支持范围查询。
- Modify: `server/modules/focus/focus.service.test.ts` - 覆盖范围查询。
- Modify: `server/modules/focus/routes.ts` - 暴露范围查询。
- Modify: `src/modules/tasks/api/tasksApi.ts` - 支持范围查询和 schedule patch。
- Modify: `src/modules/tasks/api/tasksApi.test.ts` - 覆盖 query 和 schedule patch。
- Modify: `src/modules/focus/api/focusApi.ts` - 支持 session 范围查询。
- Modify: `src/modules/focus/api/focusApi.test.ts` - 覆盖范围 query。

---

### Task 1: Shared Schedule Model

**Files:**
- Modify: `shared/domain/entities.ts`
- Create: `shared/lib/schedule.ts`
- Create: `shared/lib/schedule.test.ts`

- [x] **Step 1: Write failing schedule helper tests**

Create `shared/lib/schedule.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import type {Task} from '../domain/entities';
import {
  addMinutesToLocalDateTime,
  getTaskScheduleKind,
  isLocalDateTimeString,
  makeLocalDateTime,
  taskIntersectsDateRange,
  toCanonicalTask,
} from './schedule';

const baseTask: Omit<Task, 'allDay'> & {allDay?: boolean} = {
  id: 1,
  userId: 1,
  categoryId: 1,
  title: '写方案',
  plannedDate: '2026-06-06',
  status: 'TODO',
  createdAt: '2026-06-06T00:00:00.000Z',
  updatedAt: '2026-06-06T00:00:00.000Z',
};

describe('schedule helpers', () => {
  it('normalizes legacy tasks as all-day date tasks', () => {
    expect(toCanonicalTask(baseTask)).toMatchObject({
      plannedDate: '2026-06-06',
      allDay: true,
      plannedEndDate: undefined,
      startAt: undefined,
      endAt: undefined,
    });
  });

  it('classifies date, cross-day, and timed tasks', () => {
    expect(getTaskScheduleKind(toCanonicalTask(baseTask))).toBe('date');
    expect(getTaskScheduleKind(toCanonicalTask({...baseTask, plannedEndDate: '2026-06-08'}))).toBe('cross-day');
    expect(getTaskScheduleKind(toCanonicalTask({
      ...baseTask,
      allDay: false,
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
    }))).toBe('timed');
  });

  it('detects tasks intersecting a date range', () => {
    expect(taskIntersectsDateRange(toCanonicalTask({
      ...baseTask,
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-07',
    }), '2026-06-06', '2026-06-06')).toBe(true);

    expect(taskIntersectsDateRange(toCanonicalTask({
      ...baseTask,
      allDay: false,
      startAt: '2026-06-09T09:00:00.000',
      endAt: '2026-06-09T10:00:00.000',
    }), '2026-06-01', '2026-06-08')).toBe(false);
  });

  it('handles local datetime strings without timezone conversion', () => {
    expect(isLocalDateTimeString('2026-06-06T09:30:00.000')).toBe(true);
    expect(isLocalDateTimeString('2026-06-06T09:30:00.000Z')).toBe(false);
    expect(makeLocalDateTime('2026-06-06', 9, 5)).toBe('2026-06-06T09:05:00.000');
    expect(addMinutesToLocalDateTime('2026-06-06T09:30:00.000', 60)).toBe('2026-06-06T10:30:00.000');
  });

  it('rejects local datetime additions that cross the day boundary', () => {
    expect(() => addMinutesToLocalDateTime('2026-06-06T23:30:00.000', 60)).toThrow(
      'Local datetime addition crossed day boundary',
    );
  });
});
```

- [x] **Step 2: Run the helper test and verify RED**

Run:

```bash
npm test -- shared/lib/schedule.test.ts
```

Expected: FAIL because `shared/lib/schedule.ts` does not exist.

- [x] **Step 3: Extend `Task`**

In `shared/domain/entities.ts`, replace `Task` with:

```ts
export interface Task {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
```

Then update existing test fixtures that construct `Task` objects directly so they include:

```ts
allDay: true,
```

At minimum, scan these files and add `allDay: true` to task literals that are typed as `Task` or passed to typed component/service props:

```bash
LC_ALL=en_US.UTF-8 rg -n "plannedDate:" src server scripts shared --glob "*.{ts,tsx}"
```

Do not change runtime behavior in this cleanup. This is only keeping existing fixtures aligned with the new required field.

- [x] **Step 4: Implement schedule helpers**

Create `shared/lib/schedule.ts`:

```ts
import type {Task} from '../domain/entities';
import {addIsoDateDays, isIsoDateString} from './date';

export type TaskScheduleKind = 'date' | 'cross-day' | 'timed';
export type LegacyTask = Omit<Task, 'allDay'> & {
  allDay?: boolean;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
};

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000$/;

export function isLocalDateTimeString(value: string): boolean {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    return false;
  }

  const date = value.slice(0, 10);
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));

  return isIsoDateString(date) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function makeLocalDateTime(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000`;
}

export function addMinutesToLocalDateTime(value: string, minutes: number): string {
  if (!isLocalDateTimeString(value)) {
    throw new Error('Invalid local datetime');
  }

  const date = value.slice(0, 10);
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const totalMinutes = hour * 60 + minute + minutes;

  if (totalMinutes < 0 || totalMinutes >= 24 * 60) {
    throw new Error('Local datetime addition crossed day boundary');
  }

  return makeLocalDateTime(date, Math.floor(totalMinutes / 60), totalMinutes % 60);
}

export function getLocalDateFromDateTime(value: string): string {
  return value.slice(0, 10);
}

export function toCanonicalTask(task: LegacyTask): Task {
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
  const startDate = canonical.startAt ? getLocalDateFromDateTime(canonical.startAt) : canonical.plannedDate;
  const endDate = canonical.endAt
    ? getLocalDateFromDateTime(canonical.endAt)
    : canonical.plannedEndDate ?? canonical.plannedDate;

  return startDate <= dateTo && endDate >= dateFrom;
}

export function enumerateDateRange(dateFrom: string, dateTo: string): string[] {
  const dates: string[] = [];
  for (let date = dateFrom; date <= dateTo; date = addIsoDateDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
```

- [x] **Step 5: Run the helper test and verify GREEN**

Run:

```bash
npm test -- shared/lib/schedule.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add shared/domain/entities.ts shared/lib/schedule.ts shared/lib/schedule.test.ts
git commit -m "feat: add task schedule model helpers"
```

---

### Task 2: Task Contracts, Schemas, And Service Rules

**Files:**
- Modify: `server/modules/tasks/repository.ts`
- Modify: `server/modules/tasks/schemas.ts`
- Modify: `server/modules/tasks/schemas.test.ts`
- Modify: `server/modules/tasks/service.ts`
- Modify: `server/modules/tasks/tasks.service.test.ts`

- [x] **Step 1: Add failing schema tests**

Update the top import in `server/modules/tasks/schemas.test.ts`:

```ts
import {parseTaskBody, parseTaskQuery, parseTaskScheduleBody} from './schemas';
```

Then append these cases inside the existing `describe('task schemas', ...)` block:

```ts

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
```

- [x] **Step 2: Add failing service tests**

Append to `server/modules/tasks/tasks.service.test.ts`:

```ts
it('rejects timed schedules without start and end', () => {
  const task = {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''} as const;
  const service = new TasksService(
    {
      listByFilters: () => [],
      getById: () => task,
      create: () => task,
      updateStatus: () => task,
      updateSchedule: () => task,
      remove: () => false,
    },
    {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  expect(() => service.updateSchedule({
    taskId: 1,
    userId: 1,
    plannedDate: '2026-06-06',
    allDay: false,
  })).toThrow('Timed task requires startAt and endAt');
});

it('rejects cross-day timed schedules', () => {
  const task = {id: 1, userId: 1, categoryId: 1, title: '写方案', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''} as const;
  const service = new TasksService(
    {
      listByFilters: () => [],
      getById: () => task,
      create: () => task,
      updateStatus: () => task,
      updateSchedule: () => task,
      remove: () => false,
    },
    {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  expect(() => service.updateSchedule({
    taskId: 1,
    userId: 1,
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T23:30:00.000',
    endAt: '2026-06-07T00:30:00.000',
    allDay: false,
  })).toThrow('Cross-day timed tasks are not supported yet');
});

it('rejects invalid timed task creation through the service', () => {
  const service = new TasksService(
    {
      listByFilters: () => [],
      getById: () => undefined,
      create: () => {
        throw new Error('not used');
      },
      updateStatus: () => undefined,
      updateSchedule: () => undefined,
      remove: () => false,
    },
    {getById: () => ({id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''})},
    {getRunningByUser: () => undefined, stop: () => undefined},
  );

  expect(() => service.create({
    userId: 1,
    categoryId: 1,
    title: '非法时间段',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T10:00:00.000',
    endAt: '2026-06-06T09:00:00.000',
    allDay: false,
  })).toThrow('endAt must be after startAt');
});
```

- [x] **Step 3: Run tests and verify RED**

Run:

```bash
npm test -- server/modules/tasks/schemas.test.ts server/modules/tasks/tasks.service.test.ts
```

Expected: FAIL because schedule parser, repository method, and service method do not exist.

- [x] **Step 4: Extend task repository contracts**

In `server/modules/tasks/repository.ts`, replace the file content with:

```ts
import type {Task} from '../../../shared/domain/entities';
import type {TaskStatus} from '../../../shared/domain/status';

export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
}

export interface CreateTaskInput {
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface UpdateTaskScheduleInput {
  taskId: number;
  userId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export interface TaskRepository {
  listByFilters(filters: TaskFilters): Task[];
  getById(taskId: number, userId: number): Task | undefined;
  create(input: CreateTaskInput): Task;
  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined;
  updateSchedule(input: UpdateTaskScheduleInput): Task | undefined;
  remove(taskId: number, userId: number): boolean;
}
```

After this change, update existing task service test fakes in `server/modules/tasks/tasks.service.test.ts` so every fake `TaskRepository` object includes:

```ts
updateSchedule: vi.fn(),
```

Otherwise TypeScript will fail before the new schedule tests even run.

- [x] **Step 5: Extend task schemas**

In `server/modules/tasks/schemas.ts`:

1. Import schedule helper:

```ts
import {isLocalDateTimeString} from '../../../shared/lib/schedule';
```

2. Change `TaskBody`:

```ts
export interface TaskBody {
  title: string;
  categoryId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}
```

3. Add `TaskScheduleBody`:

```ts
export interface TaskScheduleBody {
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}
```

4. Add helpers:

```ts
function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function parseOptionalLocalDateTime(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !isLocalDateTimeString(value)) {
    throw new AppError(400, `${fieldName} must be a local ISO datetime without timezone`);
  }
  return value;
}

function assertScheduleBodyRules(body: TaskScheduleBody): void {
  if (body.plannedEndDate && body.plannedEndDate < body.plannedDate) {
    throw new AppError(400, 'plannedEndDate must be after plannedDate');
  }
  if (!body.allDay && (!body.startAt || !body.endAt)) {
    throw new AppError(400, 'Timed task requires startAt and endAt');
  }
  if (body.startAt && body.endAt && body.endAt <= body.startAt) {
    throw new AppError(400, 'endAt must be after startAt');
  }
  if (!body.allDay && body.startAt?.slice(0, 10) !== body.endAt?.slice(0, 10)) {
    throw new AppError(400, 'Cross-day timed tasks are not supported yet');
  }
}
```

5. Update `parseTaskBody` return:

```ts
const plannedDate =
  typeof payload.plannedDate === 'string'
    ? parseOptionalIsoDate(payload.plannedDate, 'plannedDate')!
    : todayIsoDate();
const plannedEndDate = parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate');
const startAt = parseOptionalLocalDateTime(payload.startAt, 'startAt');
const endAt = parseOptionalLocalDateTime(payload.endAt, 'endAt');
const allDay = typeof payload.allDay === 'boolean' ? payload.allDay : !(startAt && endAt);

const body = {
  title: typeof payload.title === 'string' ? payload.title : '',
  categoryId,
  plannedDate,
  plannedEndDate: allDay ? plannedEndDate : undefined,
  startAt: allDay ? undefined : startAt,
  endAt: allDay ? undefined : endAt,
  allDay,
};
assertScheduleBodyRules({...body, allDay});
return body;
```

6. Replace `parseTaskQuery` return type and body with:

```ts
export function parseTaskQuery(query: Record<string, unknown>): {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
} {
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

  const categoryIdValue = query.categoryId;
  const parsedCategoryId =
    typeof categoryIdValue === 'string' ? Number.parseInt(categoryIdValue, 10) : undefined;

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
  };
}
```

7. Add:

```ts
export function parseTaskScheduleBody(body: unknown): TaskScheduleBody {
  const payload = (body ?? {}) as Record<string, unknown>;
  const plannedDate = parseOptionalIsoDate(payload.plannedDate, 'plannedDate');
  if (!plannedDate) {
    throw new AppError(400, 'Invalid plannedDate');
  }

  const allDay = parseBoolean(payload.allDay, true);
  const schedule: TaskScheduleBody = {
    plannedDate,
    plannedEndDate: allDay ? parseOptionalIsoDate(payload.plannedEndDate, 'plannedEndDate') : undefined,
    startAt: allDay ? undefined : parseOptionalLocalDateTime(payload.startAt, 'startAt'),
    endAt: allDay ? undefined : parseOptionalLocalDateTime(payload.endAt, 'endAt'),
    allDay,
  };

  assertScheduleBodyRules(schedule);
  return schedule;
}
```

- [x] **Step 6: Extend task service**

In `server/modules/tasks/service.ts`:

1. Change `TaskListFilters`:

```ts
interface TaskListFilters {
  userId: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
}
```

2. Update `list`:

```ts
list(filters: TaskListFilters) {
  return this.tasks.listByFilters({
    userId: filters.userId,
    plannedDate: filters.date,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    status: filters.status,
    categoryId: filters.categoryId,
  });
}
```

3. Add imports:

```ts
import type {CreateTaskInput, TaskRepository, UpdateTaskScheduleInput} from './repository';
import {isIsoDateString} from '../../../shared/lib/date';
```

4. Add service validation method:

```ts
private validateSchedule(input: UpdateTaskScheduleInput): void {
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
  if (!input.allDay && input.startAt?.slice(0, 10) !== input.endAt?.slice(0, 10)) {
    throw new AppError(400, 'Cross-day timed tasks are not supported yet');
  }
}
```

5. Add method:

```ts
updateSchedule(input: UpdateTaskScheduleInput) {
  const existing = this.tasks.getById(input.taskId, input.userId);
  if (!existing) {
    throw new AppError(404, 'Task not found');
  }

  this.validateSchedule(input);
  const updated = this.tasks.updateSchedule(input);
  if (!updated) {
    throw new AppError(404, 'Task not found');
  }

  return updated;
}
```

6. Call the same schedule validator from `create` before repository insertion:

```ts
this.validateSchedule({
  taskId: 0,
  userId: input.userId,
  plannedDate: input.plannedDate,
  plannedEndDate: input.plannedEndDate,
  startAt: input.startAt,
  endAt: input.endAt,
  allDay: input.allDay ?? true,
});
```

Place it after category existence validation and before `return this.tasks.create(...)`.

- [x] **Step 7: Run task schema/service tests and verify GREEN**

Run:

```bash
npm test -- server/modules/tasks/schemas.test.ts server/modules/tasks/tasks.service.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add server/modules/tasks/repository.ts server/modules/tasks/schemas.ts server/modules/tasks/schemas.test.ts server/modules/tasks/service.ts server/modules/tasks/tasks.service.test.ts
git commit -m "feat: validate task scheduling rules"
```

---

### Task 3: JSON And SQLite Task Storage

**Files:**
- Modify: `server/storage/json/repositories/taskJsonRepository.ts`
- Modify: `server/storage/json/repositories/taskJsonRepository.test.ts`
- Modify: `server/storage/sqlite/migrations.ts`
- Modify: `server/storage/sqlite/repositories/rowMappers.ts`
- Modify: `server/storage/sqlite/repositories/rowMappers.test.ts`
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.ts`
- Modify: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`
- Modify: `scripts/importJsonToSqlite.ts`
- Modify: `scripts/importJsonToSqlite.test.ts`

- [x] **Step 1: Add failing JSON repository tests**

Append to `server/storage/json/repositories/taskJsonRepository.test.ts`:

```ts
it('normalizes legacy tasks and filters by schedule range', () => {
  store.write({
    users: [],
    categories: [],
    tasks: [
      {id: 1, userId: 1, categoryId: 1, title: 'Legacy', plannedDate: '2026-06-06', status: 'TODO', createdAt: '', updatedAt: ''} as never,
      {id: 2, userId: 1, categoryId: 1, title: 'Cross', plannedDate: '2026-06-05', plannedEndDate: '2026-06-07', allDay: true, status: 'TODO', createdAt: '', updatedAt: ''},
    ],
    taskExecutionSessions: [],
    dailyReports: [],
    weeklyReviews: [],
    sequences: {categories: 0, tasks: 2, taskExecutionSessions: 0, dailyReports: 0, weeklyReviews: 0},
  });

  const result = repository.listByFilters({userId: 1, dateFrom: '2026-06-06', dateTo: '2026-06-06'});

  expect(result.map((task) => task.title)).toEqual(['Legacy', 'Cross']);
  expect(result[0]).toMatchObject({allDay: true, startAt: undefined, endAt: undefined});
});

it('updates schedules in json storage', () => {
  const created = repository.create({userId: 1, categoryId: 1, title: 'Timed', plannedDate: '2026-06-06'});
  const updated = repository.updateSchedule({
    taskId: created.id,
    userId: 1,
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });

  expect(updated).toMatchObject({
    allDay: false,
    plannedEndDate: undefined,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
  });
});
```

- [x] **Step 2: Add failing SQLite repository tests**

Append to `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`:

```ts
it('persists schedule fields and filters intersecting ranges', () => {
  const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
  const task = tasks.create({userId: 1, categoryId: category.id, title: '跨天', plannedDate: '2026-06-05', plannedEndDate: '2026-06-07', allDay: true});

  expect(task).toMatchObject({plannedEndDate: '2026-06-07', allDay: true});
  expect(tasks.listByFilters({userId: 1, dateFrom: '2026-06-06', dateTo: '2026-06-06'}).map((item) => item.title)).toEqual(['跨天']);

  const updated = tasks.updateSchedule({
    taskId: task.id,
    userId: 1,
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });

  expect(updated).toMatchObject({
    allDay: false,
    plannedEndDate: undefined,
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
  });
});
```

- [x] **Step 3: Run storage tests and verify RED**

Run:

```bash
npm test -- server/storage/json/repositories/taskJsonRepository.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: FAIL because storage code does not support schedule fields.

- [x] **Step 4: Implement JSON storage support**

In `server/storage/json/repositories/taskJsonRepository.ts`:

1. Import helpers:

```ts
import {taskIntersectsDateRange, toCanonicalTask} from '../../../../shared/lib/schedule';
```

2. In `listByFilters`, map through canonical tasks and replace the date filter:

```ts
.tasks.map(toCanonicalTask).filter((task) => {
  if (task.userId !== filters.userId) return false;
  if (filters.plannedDate && !taskIntersectsDateRange(task, filters.plannedDate, filters.plannedDate)) return false;
  if (filters.dateFrom && filters.dateTo && !taskIntersectsDateRange(task, filters.dateFrom, filters.dateTo)) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.categoryId && task.categoryId !== filters.categoryId) return false;
  return true;
})
```

3. In `getById`, return canonical task:

```ts
const task = this.store.read().tasks.find((item) => item.id === taskId && item.userId === userId);
return task ? toCanonicalTask(task) : undefined;
```

4. In `create`, include schedule fields:

```ts
plannedEndDate: input.allDay ?? true ? input.plannedEndDate : undefined,
startAt: input.allDay === false ? input.startAt : undefined,
endAt: input.allDay === false ? input.endAt : undefined,
allDay: input.allDay ?? true,
```

5. Add `updateSchedule`:

```ts
updateSchedule(input: UpdateTaskScheduleInput): Task | undefined {
  return this.store.update((data) => {
    const task = data.tasks.find((item) => item.id === input.taskId && item.userId === input.userId);
    if (!task) {
      return undefined;
    }

    task.plannedDate = input.plannedDate;
    task.plannedEndDate = input.allDay ? input.plannedEndDate : undefined;
    task.startAt = input.allDay ? undefined : input.startAt;
    task.endAt = input.allDay ? undefined : input.endAt;
    task.allDay = input.allDay;
    task.updatedAt = new Date().toISOString();

    return toCanonicalTask(task);
  });
}
```

- [x] **Step 5: Implement SQLite migration and mappers**

In `server/storage/sqlite/migrations.ts`, append migration version 3:

```ts
{
  version: 3,
  name: 'task_schedule_fields',
  sql: `
    alter table tasks add column planned_end_date text;
    alter table tasks add column start_at text;
    alter table tasks add column end_at text;
    alter table tasks add column all_day integer not null default 1;

    create index if not exists idx_tasks_user_planned_end_date on tasks(user_id, planned_end_date);
    create index if not exists idx_tasks_user_start_at on tasks(user_id, start_at);
  `,
},
```

In `server/storage/sqlite/repositories/rowMappers.ts`, extend `TaskRow`. Keep the fields optional so existing mapper tests and rows from older in-memory fixtures still typecheck:

```ts
planned_end_date?: string | null;
start_at?: string | null;
end_at?: string | null;
all_day?: number;
```

Then extend `mapTaskRow`:

```ts
plannedEndDate: row.planned_end_date ?? undefined,
startAt: row.start_at ?? undefined,
endAt: row.end_at ?? undefined,
allDay: row.all_day !== 0,
```

Update `server/storage/sqlite/repositories/rowMappers.test.ts` task row fixture to include:

```ts
planned_end_date: null,
start_at: null,
end_at: null,
all_day: 1,
```

And assert:

```ts
expect(mapTaskRow({
  id: 2,
  user_id: 1,
  category_id: 1,
  title: '写方案',
  planned_date: '2026-06-05',
  planned_end_date: null,
  start_at: null,
  end_at: null,
  all_day: 1,
  status: 'TODO',
  created_at: '2026-06-05T00:00:00.000Z',
  updated_at: '2026-06-05T00:00:00.000Z',
})).toMatchObject({categoryId: 1, allDay: true});
```

- [x] **Step 6: Implement SQLite task repository support**

In `server/storage/sqlite/repositories/taskSqliteRepository.ts`:

1. Import helper and contract:

```ts
import type {CreateTaskInput, TaskFilters, TaskRepository, UpdateTaskScheduleInput} from '../../../modules/tasks/repository';
import {taskIntersectsDateRange} from '../../../../shared/lib/schedule';
```

2. After SQL filtering, apply range filtering in memory for correctness across all-day and timed shapes:

```ts
const rows = this.db
  .prepare(`select * from tasks where ${clauses.join(' and ')} order by created_at asc`)
  .all(...values) as TaskRow[];

return rows.map(mapTaskRow).filter((task) => {
  if (filters.plannedDate && !taskIntersectsDateRange(task, filters.plannedDate, filters.plannedDate)) return false;
  if (filters.dateFrom && filters.dateTo && !taskIntersectsDateRange(task, filters.dateFrom, filters.dateTo)) return false;
  return true;
});
```

3. Replace insert SQL with:

```ts
const result = this.db
  .prepare(`
    insert into tasks (
      user_id, category_id, title, planned_date, planned_end_date, start_at, end_at, all_day, status, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  .run(
    input.userId,
    input.categoryId,
    input.title.trim(),
    input.plannedDate,
    input.allDay === false ? null : input.plannedEndDate ?? null,
    input.allDay === false ? input.startAt ?? null : null,
    input.allDay === false ? input.endAt ?? null : null,
    input.allDay === false ? 0 : 1,
    'TODO',
    now,
    now,
  );
```

4. Add `updateSchedule`:

```ts
updateSchedule(input: UpdateTaskScheduleInput): Task | undefined {
  const now = new Date().toISOString();
  const result = this.db
    .prepare(`
      update tasks
      set planned_date = ?,
          planned_end_date = ?,
          start_at = ?,
          end_at = ?,
          all_day = ?,
          updated_at = ?
      where id = ? and user_id = ?
    `)
    .run(
      input.plannedDate,
      input.allDay ? input.plannedEndDate ?? null : null,
      input.allDay ? null : input.startAt ?? null,
      input.allDay ? null : input.endAt ?? null,
      input.allDay ? 1 : 0,
      now,
      input.taskId,
      input.userId,
    );

  if (result.changes === 0) {
    return undefined;
  }
  return this.getById(input.taskId, input.userId);
}
```

- [x] **Step 7: Update import script mapping**

In `scripts/importJsonToSqlite.ts`, first extend `JsonTask`:

```ts
interface JsonTask {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}
```

Then, when inserting tasks, map:

```ts
task.plannedEndDate ?? null,
task.startAt ?? null,
task.endAt ?? null,
task.allDay === false ? 0 : 1,
```

The insert statement must include `planned_end_date`, `start_at`, `end_at`, and `all_day`.

Add tests in `scripts/importJsonToSqlite.test.ts` that import a legacy task and a scheduled task:

```ts
[
  {
    id: 1,
    userId: 1,
    categoryId: 1,
    title: '旧任务',
    plannedDate: '2026-06-06',
    status: 'TODO',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    userId: 1,
    categoryId: 1,
    title: '会议',
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
    status: 'TODO',
    createdAt: '',
    updatedAt: '',
  },
]
```

Expected imported rows map to `allDay: true` for the legacy task and `allDay: false` with `startAt/endAt` for the scheduled task.

- [x] **Step 8: Run storage tests and verify GREEN**

Run:

```bash
npm test -- server/storage/json/repositories/taskJsonRepository.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts scripts/importJsonToSqlite.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add server/storage/json/repositories/taskJsonRepository.ts server/storage/json/repositories/taskJsonRepository.test.ts server/storage/sqlite/migrations.ts server/storage/sqlite/repositories/rowMappers.ts server/storage/sqlite/repositories/rowMappers.test.ts server/storage/sqlite/repositories/taskSqliteRepository.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts scripts/importJsonToSqlite.ts scripts/importJsonToSqlite.test.ts
git commit -m "feat: persist task schedules"
```

---

### Task 4: Task HTTP And Frontend API

**Files:**
- Modify: `server/modules/tasks/routes.ts`
- Modify: `src/modules/tasks/api/tasksApi.ts`
- Modify: `src/modules/tasks/api/tasksApi.test.ts`

- [x] **Step 1: Add failing API client tests**

Append to `src/modules/tasks/api/tasksApi.test.ts`:

```ts
it('queries tasks by date range', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.getTasks({dateFrom: '2026-06-01', dateTo: '2026-06-07', categoryId: 2});

  expect(fetch).toHaveBeenCalledWith('/api/tasks?dateFrom=2026-06-01&dateTo=2026-06-07&categoryId=2', expect.any(Object));
});

it('updates a task schedule', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({id: 1})});
  vi.stubGlobal('fetch', fetch);

  await tasksApi.updateTaskSchedule(1, {
    plannedDate: '2026-06-06',
    startAt: '2026-06-06T09:00:00.000',
    endAt: '2026-06-06T10:00:00.000',
    allDay: false,
  });

  expect(fetch).toHaveBeenCalledWith('/api/tasks/1/schedule', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({
      plannedDate: '2026-06-06',
      startAt: '2026-06-06T09:00:00.000',
      endAt: '2026-06-06T10:00:00.000',
      allDay: false,
    }),
  }));
});
```

- [x] **Step 2: Run API test and verify RED**

Run:

```bash
npm test -- src/modules/tasks/api/tasksApi.test.ts
```

Expected: FAIL because `dateFrom/dateTo` and `updateTaskSchedule` are absent.

- [x] **Step 3: Add schedule route**

In `server/modules/tasks/routes.ts`:

1. Import parser:

```ts
parseTaskScheduleBody,
```

2. Add before delete route:

```ts
router.patch('/tasks/:id/schedule', (req, res) => {
  try {
    const {userId} = getUserContext();
    const id = parseTaskId(req.params.id);
    const body = parseTaskScheduleBody(req.body);
    const task = service.updateSchedule({taskId: id, userId, ...body});
    res.json(task);
  } catch (error) {
    handleHttpError(res, error);
  }
});
```

- [x] **Step 4: Extend `tasksApi`**

In `src/modules/tasks/api/tasksApi.ts`, update `getTasks` filter type:

```ts
getTasks(filters?: {date?: string; dateFrom?: string; dateTo?: string; status?: TaskStatus; categoryId?: number}): Promise<Task[]> {
```

Add params:

```ts
if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
if (filters?.dateTo) params.append('dateTo', filters.dateTo);
```

Update `createTask` input type so calendar can create all-day or timed tasks through the existing task creation API:

```ts
createTask(task: {
  title: string;
  categoryId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}): Promise<Task> {
  return requestJson<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
},
```

Add method:

```ts
updateTaskSchedule(
  id: number,
  schedule: {plannedDate: string; plannedEndDate?: string; startAt?: string; endAt?: string; allDay: boolean},
): Promise<Task> {
  return requestJson<Task>(`/api/tasks/${id}/schedule`, {
    method: 'PATCH',
    body: JSON.stringify(schedule),
  });
},
```

- [x] **Step 5: Run task API tests and verify GREEN**

Run:

```bash
npm test -- server/modules/tasks/schemas.test.ts server/modules/tasks/tasks.service.test.ts src/modules/tasks/api/tasksApi.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/modules/tasks/routes.ts src/modules/tasks/api/tasksApi.ts src/modules/tasks/api/tasksApi.test.ts
git commit -m "feat: expose task schedule api"
```

---

### Task 5: Focus Session Range HTTP And API

**Files:**
- Modify: `server/modules/focus/schemas.ts`
- Modify: `server/modules/focus/schemas.test.ts`
- Modify: `server/modules/focus/service.ts`
- Modify: `server/modules/focus/focus.service.test.ts`
- Modify: `server/modules/focus/routes.ts`
- Modify: `src/modules/focus/api/focusApi.ts`
- Modify: `src/modules/focus/api/focusApi.test.ts`

- [x] **Step 1: Add failing focus schema tests**

Update the top import in `server/modules/focus/schemas.test.ts`:

```ts
import {parseSessionDateQuery, parseSessionQuery} from './schemas';
```

Then append these cases inside the existing `describe('focus schemas', ...)` block:

```ts

it('parses focus session date range query', () => {
  expect(parseSessionQuery({dateFrom: '2026-06-01', dateTo: '2026-06-07'})).toEqual({
    dateFrom: '2026-06-01',
    dateTo: '2026-06-07',
  });
});

it('rejects mixed focus session date query', () => {
  expect(() => parseSessionQuery({date: '2026-06-06', dateFrom: '2026-06-01', dateTo: '2026-06-07'}))
    .toThrow('Use either date or dateFrom/dateTo');
});
```

- [x] **Step 2: Add failing focus API test**

Append to `src/modules/focus/api/focusApi.test.ts`:

```ts
it('queries sessions by date range', async () => {
  const fetch = vi.fn().mockResolvedValue({ok: true, json: async () => []});
  vi.stubGlobal('fetch', fetch);

  await focusApi.getSessions({dateFrom: '2026-06-01', dateTo: '2026-06-07'});

  expect(fetch).toHaveBeenCalledWith('/api/task-sessions?dateFrom=2026-06-01&dateTo=2026-06-07', expect.any(Object));
});
```

- [x] **Step 3: Run focus tests and verify RED**

Run:

```bash
npm test -- server/modules/focus/schemas.test.ts src/modules/focus/api/focusApi.test.ts
```

Expected: FAIL because `parseSessionQuery` and range API are absent.

- [x] **Step 4: Implement focus query parser**

In `server/modules/focus/schemas.ts`, add:

```ts
export function parseSessionQuery(query: Record<string, unknown>): {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
} {
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

  return {date, dateFrom, dateTo};
}
```

- [x] **Step 5: Extend focus service**

In `server/modules/focus/service.ts`, add method:

```ts
listByDateRange(userId: number, dateFrom: string, dateTo: string) {
  const {startAt} = getChinaDateUtcRange(dateFrom);
  const {endAt} = getChinaDateUtcRange(dateTo);
  return this.sessions.listByDateRange(userId, startAt, endAt);
}
```

- [x] **Step 6: Extend focus route**

In `server/modules/focus/routes.ts`:

1. Import parser:

```ts
import {parseSessionId, parseSessionQuery, parseTaskId} from './schemas';
```

2. Replace `/task-sessions` route body with:

```ts
router.get('/task-sessions', (req, res) => {
  try {
    const {userId} = getUserContext();
    const query = parseSessionQuery(req.query as Record<string, unknown>);
    if (query.dateFrom && query.dateTo) {
      res.json(service.listByDateRange(userId, query.dateFrom, query.dateTo));
      return;
    }
    res.json(service.listByDate(userId, query.date));
  } catch (error) {
    handleHttpError(res, error);
  }
});
```

- [x] **Step 7: Extend focus API**

In `src/modules/focus/api/focusApi.ts`, change `getSessions` signature and params:

```ts
getSessions(filters?: {date?: string; dateFrom?: string; dateTo?: string}): Promise<TaskExecutionSession[]> {
  const params = new URLSearchParams();
  if (filters?.date) params.append('date', filters.date);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  const query = params.toString();
  return requestJson<TaskExecutionSession[]>(`/api/task-sessions${query ? `?${query}` : ''}`);
},
```

- [x] **Step 8: Run focus tests and verify GREEN**

Run:

```bash
npm test -- server/modules/focus/schemas.test.ts server/modules/focus/focus.service.test.ts src/modules/focus/api/focusApi.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add server/modules/focus/schemas.ts server/modules/focus/schemas.test.ts server/modules/focus/service.ts server/modules/focus/focus.service.test.ts server/modules/focus/routes.ts src/modules/focus/api/focusApi.ts src/modules/focus/api/focusApi.test.ts
git commit -m "feat: expose focus session range api"
```

---

## Backend Final Verification

- [x] Run:

```bash
npm test -- shared/lib/schedule.test.ts server/modules/tasks server/storage/json server/storage/sqlite server/modules/focus scripts/importJsonToSqlite.test.ts src/modules/tasks/api/tasksApi.test.ts src/modules/focus/api/focusApi.test.ts
```

Expected: all selected tests pass.

- [x] Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

- [x] Check migration order:

```bash
LC_ALL=en_US.UTF-8 rg -n "version: 3|task_schedule_fields" server/storage/sqlite/migrations.ts
```

Expected: both strings exist exactly once.

## Self-Review Checklist

- `Task` has `plannedEndDate/startAt/endAt/allDay`.
- Old JSON tasks without `allDay` read as `allDay: true`.
- `GET /api/tasks?dateFrom=...&dateTo=...` returns intersecting date, cross-day, and timed tasks.
- `PATCH /api/tasks/:id/schedule` clears `startAt/endAt` when `allDay=true`.
- Timed tasks crossing local dates are rejected.
- Focus sessions support either `date` or `dateFrom/dateTo`, never both.
- No backend code creates a separate `CalendarEvent` model.

## Execution Handoff

Backend plan complete. Execute this before the frontend and interaction plans. The frontend plan assumes `tasksApi.getTasks({dateFrom,dateTo})`, `tasksApi.updateTaskSchedule`, and `focusApi.getSessions({dateFrom,dateTo})` already exist.
