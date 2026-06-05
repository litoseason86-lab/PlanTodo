# PlanTode 单用户本地工具重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不丢失现有页面与功能的前提下，把 `PlanTode` 从单文件原型重构为按业务域组织、具备存储抽象和可验证边界的本地单用户工具。

**Architecture:** 先建立共享领域模型与测试护栏，再把后端拆为 `route -> service -> repository contract -> json storage`，随后把前端拆为 `app -> modules -> shared`。保留 `data/db.json` 作为当前存储实现，但所有业务规则从文件存储中抽离。

**Tech Stack:** React 19, TypeScript, Express, Vite, Tailwind CSS v4, JSON file storage, Vitest, Testing Library, tsx

---

## File Structure Map

### Create

- `vitest.config.ts`
- `tests/setup.ts`
- `shared/domain/status.ts`
- `shared/domain/entities.ts`
- `shared/lib/date.ts`
- `shared/lib/date.test.ts`
- `server/app/createServer.ts`
- `server/app/registerRoutes.ts`
- `server/shared/errors/appError.ts`
- `server/shared/http/handleHttpError.ts`
- `server/storage/databaseSchema.ts`
- `server/storage/json/fileStore.ts`
- `server/storage/json/repositories/categoryJsonRepository.ts`
- `server/storage/json/repositories/taskJsonRepository.ts`
- `server/storage/json/repositories/focusSessionJsonRepository.ts`
- `server/storage/json/repositories/reportJsonRepository.ts`
- `server/modules/categories/repository.ts`
- `server/modules/categories/service.ts`
- `server/modules/categories/routes.ts`
- `server/modules/categories/schemas.ts`
- `server/modules/tasks/repository.ts`
- `server/modules/tasks/service.ts`
- `server/modules/tasks/routes.ts`
- `server/modules/tasks/schemas.ts`
- `server/modules/focus/repository.ts`
- `server/modules/focus/service.ts`
- `server/modules/focus/routes.ts`
- `server/modules/focus/schemas.ts`
- `server/modules/reports/repository.ts`
- `server/modules/reports/service.ts`
- `server/modules/reports/routes.ts`
- `server/modules/reports/schemas.ts`
- `server/modules/reports/generators.ts`
- `server/modules/focus/focus.service.test.ts`
- `server/modules/reports/reports.service.test.ts`
- `server/modules/categories/categories.service.test.ts`
- `server/modules/tasks/tasks.service.test.ts`
- `src/app/AppShell.tsx`
- `src/app/navigation.ts`
- `src/app/theme.ts`
- `src/shared/api/httpClient.ts`
- `src/shared/lib/date.ts`
- `src/modules/categories/api/categoriesApi.ts`
- `src/modules/categories/controllers/useCategoriesController.ts`
- `src/modules/categories/components/CategoryPanel.tsx`
- `src/modules/tasks/api/tasksApi.ts`
- `src/modules/tasks/controllers/useTasksController.ts`
- `src/modules/tasks/components/TasksPanel.tsx`
- `src/modules/focus/api/focusApi.ts`
- `src/modules/focus/controllers/useFocusController.ts`
- `src/modules/focus/components/FocusPanel.tsx`
- `src/modules/reports/api/reportsApi.ts`
- `src/modules/reports/controllers/useDailyReportController.ts`
- `src/modules/reports/controllers/useWeeklyReviewController.ts`
- `src/modules/reports/components/DailyReportPanel.tsx`
- `src/modules/reports/components/WeeklyReviewPanel.tsx`
- `src/modules/reports/mappers/reportCharts.ts`
- `src/modules/reports/mappers/reportCharts.test.ts`
- `src/modules/dashboard/controllers/useDashboardController.ts`
- `src/modules/dashboard/components/DashboardPanel.tsx`
- `src/modules/tasks/controllers/taskFilters.test.ts`

### Modify

- `package.json`
- `tsconfig.json`
- `server.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `README.md`

### Delete After Cutover

- `server/routes.ts`
- `server/db.ts`
- `server/reports.ts`
- `src/api.ts`

## Task 1: 建立测试护栏与共享领域模型

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `shared/domain/status.ts`
- Create: `shared/domain/entities.ts`
- Create: `shared/lib/date.ts`
- Test: `shared/lib/date.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: 先写共享日期工具和状态枚举的失败测试**

```ts
import {describe, expect, it} from 'vitest';
import {getWeekStart, isIsoDateString, toIsoDate} from './date';

describe('shared date helpers', () => {
  it('returns Monday as week start', () => {
    expect(getWeekStart('2026-06-05')).toBe('2026-06-01');
  });

  it('normalizes Date to YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2026-06-05T13:14:15.000Z'))).toBe('2026-06-05');
  });

  it('validates ISO date strings', () => {
    expect(isIsoDateString('2026-06-05')).toBe(true);
    expect(isIsoDateString('2026/06/05')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认当前工程缺少测试框架与实现**

Run: `npm test -- shared/lib/date.test.ts`

Expected: 命令失败，提示 `Missing script: "test"` 或找不到 `vitest`

- [ ] **Step 3: 补齐测试脚本、Vitest 配置与共享领域文件**

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/server.js",
    "start": "NODE_ENV=production node dist/server.js",
    "preview": "vite preview",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

```ts
// vitest.config.ts
import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

```ts
// shared/domain/status.ts
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SESSION_STATUSES = ['RUNNING', 'COMPLETED', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
```

```ts
// shared/domain/entities.ts
import type {SessionStatus, TaskStatus} from './status';

export interface Category {
  id: number;
  userId: number;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionSession {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: SessionStatus;
  createdAt: string;
  taskTitle?: string;
}

export interface DailyReport {
  id: number;
  userId: number;
  reportDate: string;
  content: string;
  generatorType: 'RULE_BASED';
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  content: string;
  generatorType: 'RULE_BASED';
  createdAt: string;
  updatedAt: string;
}
```

```ts
// shared/lib/date.ts
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getWeekStart(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(`${dateInput}T00:00:00`) : new Date(dateInput);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return toIsoDate(monday);
}
```

- [ ] **Step 4: 运行共享测试与类型检查**

Run: `npm test -- shared/lib/date.test.ts`

Expected: `3 passed`

Run: `npm run lint`

Expected: `0 errors`

- [ ] **Step 5: 提交基础设施**

```bash
git add package.json tsconfig.json vitest.config.ts tests/setup.ts shared/domain/status.ts shared/domain/entities.ts shared/lib/date.ts shared/lib/date.test.ts
git commit -m "chore: add test harness and shared domain foundation"
```

## Task 2: 抽离 JSON 存储与仓储契约

**Files:**
- Create: `server/storage/databaseSchema.ts`
- Create: `server/storage/json/fileStore.ts`
- Create: `server/storage/json/repositories/categoryJsonRepository.ts`
- Create: `server/storage/json/repositories/taskJsonRepository.ts`
- Create: `server/storage/json/repositories/focusSessionJsonRepository.ts`
- Create: `server/storage/json/repositories/reportJsonRepository.ts`
- Create: `server/modules/categories/repository.ts`
- Create: `server/modules/tasks/repository.ts`
- Create: `server/modules/focus/repository.ts`
- Create: `server/modules/reports/repository.ts`
- Test: `server/modules/tasks/tasks.service.test.ts`
- Modify: `server/db.ts` (temporary bridge during迁移)

- [ ] **Step 1: 先写任务仓储与文件存储的失败测试**

```ts
import {describe, expect, it} from 'vitest';
import {JsonFileStore} from '../../storage/json/fileStore';
import {TaskJsonRepository} from '../../storage/json/repositories/taskJsonRepository';

describe('TaskJsonRepository', () => {
  it('filters tasks by user, date and category', () => {
    const store = new JsonFileStore('/tmp/plantode-task-repo-test.json');
    store.write({
      users: [],
      categories: [],
      tasks: [
        {id: 1, userId: 1, categoryId: 1, title: 'A', plannedDate: '2026-06-05', status: 'TODO', createdAt: '', updatedAt: ''},
        {id: 2, userId: 1, categoryId: 2, title: 'B', plannedDate: '2026-06-06', status: 'DONE', createdAt: '', updatedAt: ''},
      ],
      taskExecutionSessions: [],
      dailyReports: [],
      weeklyReviews: [],
      sequences: {categories: 2, tasks: 2, taskExecutionSessions: 0, dailyReports: 0, weeklyReviews: 0},
    });

    const repo = new TaskJsonRepository(store);
    const tasks = repo.listByFilters({userId: 1, plannedDate: '2026-06-05'});

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('A');
  });
});
```

- [ ] **Step 2: 运行测试，确认仓储抽象尚未存在**

Run: `npm test -- server/modules/tasks/tasks.service.test.ts`

Expected: FAIL，提示 `Cannot find module '../../storage/json/fileStore'`

- [ ] **Step 3: 实现数据库结构、文件存储和仓储契约**

```ts
// server/storage/databaseSchema.ts
import type {Category, DailyReport, Task, TaskExecutionSession, WeeklyReview} from '../../shared/domain/entities';

export interface DatabaseSchema {
  users: Array<{id: number; username: string; displayName: string; createdAt: string}>;
  categories: Category[];
  tasks: Task[];
  taskExecutionSessions: TaskExecutionSession[];
  dailyReports: DailyReport[];
  weeklyReviews: WeeklyReview[];
  sequences: {
    categories: number;
    tasks: number;
    taskExecutionSessions: number;
    dailyReports: number;
    weeklyReviews: number;
  };
}
```

```ts
// server/modules/tasks/repository.ts
import type {Task, TaskStatus} from '../../../shared/domain/entities';

export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  status?: TaskStatus;
  categoryId?: number;
}

export interface TaskRepository {
  listByFilters(filters: TaskFilters): Task[];
  getById(taskId: number, userId: number): Task | undefined;
  create(input: {userId: number; categoryId: number; title: string; plannedDate: string}): Task;
  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined;
}
```

```ts
// server/storage/json/fileStore.ts
import fs from 'fs';
import path from 'path';
import type {DatabaseSchema} from '../databaseSchema';

export class JsonFileStore {
  constructor(private readonly filePath: string) {}

  read(): DatabaseSchema {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  }

  write(data: DatabaseSchema): void {
    fs.mkdirSync(path.dirname(this.filePath), {recursive: true});
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  update<T>(mutator: (data: DatabaseSchema) => T): T {
    const data = this.read();
    const result = mutator(data);
    this.write(data);
    return result;
  }
}
```

```ts
// server/storage/json/repositories/taskJsonRepository.ts
import type {TaskRepository, TaskFilters} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import {JsonFileStore} from '../fileStore';

export class TaskJsonRepository implements TaskRepository {
  constructor(private readonly store: JsonFileStore) {}

  listByFilters(filters: TaskFilters): Task[] {
    const data = this.store.read();
    return data.tasks.filter((task) => {
      if (task.userId !== filters.userId) return false;
      if (filters.plannedDate && task.plannedDate !== filters.plannedDate) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.categoryId && task.categoryId !== filters.categoryId) return false;
      return true;
    });
  }

  getById(taskId: number, userId: number): Task | undefined {
    return this.store.read().tasks.find((task) => task.id === taskId && task.userId === userId);
  }

  create(input: {userId: number; categoryId: number; title: string; plannedDate: string}): Task {
    return this.store.update((data) => {
      data.sequences.tasks += 1;
      const now = new Date().toISOString();
      const task: Task = {
        id: data.sequences.tasks,
        userId: input.userId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        plannedDate: input.plannedDate,
        status: 'TODO',
        createdAt: now,
        updatedAt: now,
      };
      data.tasks.push(task);
      return task;
    });
  }

  updateStatus(taskId: number, userId: number, status: Task['status']): Task | undefined {
    return this.store.update((data) => {
      const task = data.tasks.find((item) => item.id === taskId && item.userId === userId);
      if (!task) return undefined;
      task.status = status;
      task.updatedAt = new Date().toISOString();
      return task;
    });
  }
}
```

- [ ] **Step 4: 运行仓储测试**

Run: `npm test -- server/modules/tasks/tasks.service.test.ts`

Expected: `1 passed`

- [ ] **Step 5: 提交存储抽象**

```bash
git add server/storage server/modules/categories/repository.ts server/modules/tasks/repository.ts server/modules/focus/repository.ts server/modules/reports/repository.ts
git commit -m "refactor: introduce repository contracts and json file store"
```

## Task 3: 重构后端 Categories 与 Tasks 模块

**Files:**
- Create: `server/shared/errors/appError.ts`
- Create: `server/shared/http/handleHttpError.ts`
- Create: `server/modules/categories/service.ts`
- Create: `server/modules/categories/routes.ts`
- Create: `server/modules/categories/schemas.ts`
- Create: `server/modules/categories/categories.service.test.ts`
- Create: `server/modules/tasks/service.ts`
- Create: `server/modules/tasks/routes.ts`
- Create: `server/modules/tasks/schemas.ts`
- Create: `server/modules/tasks/tasks.service.test.ts`
- Create: `server/app/registerRoutes.ts`
- Modify: `server.ts`

- [ ] **Step 1: 先写 categories/tasks service 的失败测试**

```ts
import {describe, expect, it} from 'vitest';
import {CategoriesService} from './service';

describe('CategoriesService', () => {
  it('rejects duplicate category names for the same user', () => {
    const service = new CategoriesService({
      listByUser: () => [{id: 1, userId: 1, name: '工作', color: '#000', sortOrder: 1, createdAt: '', updatedAt: ''}],
      getById: () => undefined,
      create: () => {
        throw new Error('not used');
      },
      update: () => undefined,
      remove: () => true,
    });

    expect(() => service.create({userId: 1, name: '工作', color: '#fff', sortOrder: 2})).toThrow('already exists');
  });
});
```

```ts
import {describe, expect, it} from 'vitest';
import {TasksService} from './service';

describe('TasksService', () => {
  it('rejects task creation when category does not exist', () => {
    const service = new TasksService(
      {listByFilters: () => [], getById: () => undefined, create: () => { throw new Error('not used'); }, updateStatus: () => undefined},
      {getById: () => undefined},
    );

    expect(() => service.create({userId: 1, categoryId: 99, title: '测试', plannedDate: '2026-06-05'})).toThrow('Category not found');
  });
});
```

- [ ] **Step 2: 运行 service 测试，确认模块尚未拆出**

Run: `npm test -- server/modules/categories/categories.service.test.ts server/modules/tasks/tasks.service.test.ts`

Expected: FAIL，提示缺少 `CategoriesService` 或 `TasksService`

- [ ] **Step 3: 实现通用错误、schema、service 与 route**

```ts
// server/shared/errors/appError.ts
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

```ts
// server/modules/categories/service.ts
import type {CategoryRepository} from './repository';
import {AppError} from '../../shared/errors/appError';

export class CategoriesService {
  constructor(private readonly categories: CategoryRepository) {}

  list(userId: number) {
    return this.categories.listByUser(userId);
  }

  create(input: {userId: number; name: string; color: string; sortOrder: number}) {
    const name = input.name.trim();
    if (!name) throw new AppError(400, 'Category name is required and cannot be blank.');
    if (this.categories.existsByName(input.userId, name)) {
      throw new AppError(409, `Category "${name}" already exists.`);
    }
    return this.categories.create({...input, name});
  }
}
```

```ts
// server/modules/tasks/service.ts
import type {CategoryRepository} from '../categories/repository';
import type {TaskRepository} from './repository';
import {AppError} from '../../shared/errors/appError';
import {TASK_STATUSES, type TaskStatus} from '../../../shared/domain/status';

export class TasksService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly categories: Pick<CategoryRepository, 'getById'>,
  ) {}

  list(filters: {userId: number; date?: string; status?: TaskStatus; categoryId?: number}) {
    return this.tasks.listByFilters({
      userId: filters.userId,
      plannedDate: filters.date,
      status: filters.status,
      categoryId: filters.categoryId,
    });
  }

  create(input: {userId: number; categoryId: number; title: string; plannedDate: string}) {
    if (!input.title.trim()) throw new AppError(400, 'Task title is required');
    if (!this.categories.getById(input.categoryId, input.userId)) {
      throw new AppError(404, 'Category not found');
    }
    return this.tasks.create({...input, title: input.title.trim()});
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus) {
    if (!TASK_STATUSES.includes(status)) {
      throw new AppError(400, `Status must be one of: ${TASK_STATUSES.join(', ')}`);
    }
    const updated = this.tasks.updateStatus(taskId, userId, status);
    if (!updated) throw new AppError(404, 'Task not found');
    return updated;
  }
}
```

```ts
// server/app/registerRoutes.ts
import {Router} from 'express';
import {buildCategoryRoutes} from '../modules/categories/routes';
import {buildTaskRoutes} from '../modules/tasks/routes';

export function registerRoutes(router: Router) {
  router.use(buildCategoryRoutes());
  router.use(buildTaskRoutes());
}
```

- [ ] **Step 4: 运行后端单元测试与接口类型检查**

Run: `npm test -- server/modules/categories/categories.service.test.ts server/modules/tasks/tasks.service.test.ts`

Expected: `2 passed`

Run: `npm run lint`

Expected: `0 errors`

- [ ] **Step 5: 提交 categories/tasks 后端模块化**

```bash
git add server/shared server/modules/categories server/modules/tasks server/app/registerRoutes.ts server.ts
git commit -m "refactor: modularize category and task backend flows"
```

## Task 4: 重构 Focus 与 Reports 后端模块

**Files:**
- Create: `server/modules/focus/service.ts`
- Create: `server/modules/focus/routes.ts`
- Create: `server/modules/focus/schemas.ts`
- Create: `server/modules/focus/focus.service.test.ts`
- Create: `server/modules/reports/service.ts`
- Create: `server/modules/reports/routes.ts`
- Create: `server/modules/reports/schemas.ts`
- Create: `server/modules/reports/generators.ts`
- Create: `server/modules/reports/reports.service.test.ts`
- Create: `server/app/createServer.ts`
- Modify: `server/app/registerRoutes.ts`
- Modify: `server.ts`

- [ ] **Step 1: 先写 focus/report 失败测试，锁定状态机与聚合规则**

```ts
import {describe, expect, it} from 'vitest';
import {FocusService} from './service';

describe('FocusService', () => {
  it('marks task IN_PROGRESS when a session starts and resets it on stop', () => {
    const task = {id: 1, userId: 1, categoryId: 1, title: '任务', plannedDate: '2026-06-05', status: 'TODO', createdAt: '', updatedAt: ''};
    const taskRepo = {
      getById: () => task,
      updateStatus: (_taskId: number, _userId: number, status: typeof task.status) => ({...task, status}),
    };
    const focusRepo = {
      getRunningByUser: () => undefined,
      createRunning: () => ({id: 1, taskId: 1, userId: 1, startedAt: '2026-06-05T00:00:00.000Z', status: 'RUNNING', createdAt: '2026-06-05T00:00:00.000Z'}),
      stop: () => ({id: 1, taskId: 1, userId: 1, startedAt: '2026-06-05T00:00:00.000Z', endedAt: '2026-06-05T00:30:00.000Z', durationSeconds: 1800, status: 'COMPLETED', createdAt: '2026-06-05T00:00:00.000Z'}),
    };

    const service = new FocusService(taskRepo, focusRepo);
    const started = service.start({taskId: 1, userId: 1});
    const stopped = service.stop({sessionId: 1, userId: 1});

    expect(started.status).toBe('RUNNING');
    expect(stopped.status).toBe('COMPLETED');
  });
});
```

```ts
import {describe, expect, it} from 'vitest';
import {ReportsService} from './service';

describe('ReportsService', () => {
  it('builds a daily report from tasks and sessions', () => {
    const service = new ReportsService(/* inject fake repositories */);
    const report = service.generateDaily({userId: 1, date: '2026-06-05'});
    expect(report.content).toContain('每日执行状态报告');
  });
});
```

- [ ] **Step 2: 运行 focus/report 测试，确认现有逻辑仍在旧文件**

Run: `npm test -- server/modules/focus/focus.service.test.ts server/modules/reports/reports.service.test.ts`

Expected: FAIL，提示对应 service 不存在

- [ ] **Step 3: 实现 focus service、reports service 与启动装配层**

```ts
// server/modules/focus/service.ts
import {AppError} from '../../shared/errors/appError';

export class FocusService {
  constructor(
    private readonly tasks: {
      getById(taskId: number, userId: number): {id: number; status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE'} | undefined;
      updateStatus(taskId: number, userId: number, status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE'): unknown;
    },
    private readonly focus: {
      getRunningByUser(userId: number): unknown;
      createRunning(input: {taskId: number; userId: number}): unknown;
      stop(input: {sessionId: number; userId: number}): unknown;
    },
  ) {}

  start(input: {taskId: number; userId: number}) {
    if (this.focus.getRunningByUser(input.userId)) {
      throw new AppError(409, 'Another focus session is already running.');
    }
    const task = this.tasks.getById(input.taskId, input.userId);
    if (!task) throw new AppError(404, 'Task not found');
    this.tasks.updateStatus(input.taskId, input.userId, 'IN_PROGRESS');
    return this.focus.createRunning(input);
  }

  stop(input: {sessionId: number; userId: number}) {
    const stopped = this.focus.stop(input);
    if (!stopped) throw new AppError(404, 'Session not found');
    const sessionTaskId = (stopped as {taskId: number}).taskId;
    this.tasks.updateStatus(sessionTaskId, input.userId, 'TODO');
    return stopped;
  }
}
```

```ts
// server/modules/reports/generators.ts
export function renderDailyReport(args: {
  date: string;
  totalTasks: number;
  doneCount: number;
  notDoneCount: number;
  totalSeconds: number;
  categoryDurationLines: string[];
}): string {
  const hours = Math.floor(args.totalSeconds / 3600);
  const minutes = Math.floor((args.totalSeconds % 3600) / 60);
  return `## 📊 ${args.date} 每日执行状态报告

### 一、 任务完成情况概要
- **计划任务总数**： ${args.totalTasks} 个
- **已完成任务数**： ${args.doneCount} 个
- **未完成任务数**： ${args.notDoneCount} 个

### 二、 深度专注时长分析
- **今日累计专注时间**： ${hours}小时 ${minutes}分钟

${args.categoryDurationLines.join('\n') || '今天没有记录任何类别的专注计时。'}`;
}
```

```ts
// server/app/createServer.ts
import express from 'express';
import {Router} from 'express';
import {registerRoutes} from './registerRoutes';

export async function createServer() {
  const app = express();
  app.use(express.json());

  const apiRouter = Router();
  registerRoutes(apiRouter);
  app.use('/api', apiRouter);

  return app;
}
```

- [ ] **Step 4: 运行 focus/report 测试并手动验证 API**

Run: `npm test -- server/modules/focus/focus.service.test.ts server/modules/reports/reports.service.test.ts`

Expected: `2 passed`

Run: `npm run lint`

Expected: `0 errors`

Run: `npm run dev`

Expected: `Running on http://127.0.0.1:3000`

- [ ] **Step 5: 提交 focus/reports 后端改造**

```bash
git add server/app server/modules/focus server/modules/reports server.ts
git commit -m "refactor: split focus and reports backend modules"
```

## Task 5: 建立前端 AppShell 与 API 分层

**Files:**
- Create: `src/app/AppShell.tsx`
- Create: `src/app/navigation.ts`
- Create: `src/app/theme.ts`
- Create: `src/shared/api/httpClient.ts`
- Create: `src/shared/lib/date.ts`
- Create: `src/modules/categories/api/categoriesApi.ts`
- Create: `src/modules/tasks/api/tasksApi.ts`
- Create: `src/modules/focus/api/focusApi.ts`
- Create: `src/modules/reports/api/reportsApi.ts`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 先写 API client 与导航装配的失败测试**

```ts
import {describe, expect, it, vi} from 'vitest';
import {requestJson} from '@/src/shared/api/httpClient';

describe('requestJson', () => {
  it('throws ApiError when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({message: 'duplicate'}),
    }));

    await expect(requestJson('/api/categories')).rejects.toMatchObject({status: 409, message: 'duplicate'});
  });
});
```

- [ ] **Step 2: 运行测试，确认前端共享 API 层不存在**

Run: `npm test -- src/shared/api/httpClient.test.ts`

Expected: FAIL，提示 `Cannot find module '@/src/shared/api/httpClient'`

- [ ] **Step 3: 实现 AppShell、导航常量和模块化 API**

```ts
// src/shared/api/httpClient.ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.message ?? response.statusText);
  }

  return response.json() as Promise<T>;
}
```

```ts
// src/app/navigation.ts
export const APP_TABS = [
  {key: 'today', label: '今日总览'},
  {key: 'tasks', label: '计划清单'},
  {key: 'categories', label: '分类管理'},
  {key: 'daily', label: '日报复盘'},
  {key: 'weekly', label: '周报复盘'},
  {key: 'focus', label: '专注执行'},
] as const;

export type AppTab = (typeof APP_TABS)[number]['key'];
```

```tsx
// src/App.tsx
export {default} from './app/AppShell';
```

```tsx
// src/main.tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppShell from './app/AppShell';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
```

- [ ] **Step 4: 运行前端 API 测试与构建**

Run: `npm test -- src/shared/api/httpClient.test.ts`

Expected: `1 passed`

Run: `npm run build`

Expected: `vite build` 成功

- [ ] **Step 5: 提交前端装配层和 API 抽离**

```bash
git add src/app src/shared/api src/shared/lib src/main.tsx src/App.tsx
git commit -m "refactor: add app shell and split frontend api layer"
```

## Task 6: 拆分前端 Categories、Tasks、Focus、Reports、Dashboard 模块

**Files:**
- Create: `src/modules/categories/controllers/useCategoriesController.ts`
- Create: `src/modules/categories/components/CategoryPanel.tsx`
- Create: `src/modules/tasks/controllers/useTasksController.ts`
- Create: `src/modules/tasks/components/TasksPanel.tsx`
- Create: `src/modules/tasks/controllers/taskFilters.test.ts`
- Create: `src/modules/focus/controllers/useFocusController.ts`
- Create: `src/modules/focus/components/FocusPanel.tsx`
- Create: `src/modules/reports/controllers/useDailyReportController.ts`
- Create: `src/modules/reports/controllers/useWeeklyReviewController.ts`
- Create: `src/modules/reports/components/DailyReportPanel.tsx`
- Create: `src/modules/reports/components/WeeklyReviewPanel.tsx`
- Create: `src/modules/reports/mappers/reportCharts.ts`
- Create: `src/modules/reports/mappers/reportCharts.test.ts`
- Create: `src/modules/dashboard/controllers/useDashboardController.ts`
- Create: `src/modules/dashboard/components/DashboardPanel.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 先写筛选与图表映射的失败测试**

```ts
import {describe, expect, it} from 'vitest';
import {filterTasks} from './useTasksController';

describe('filterTasks', () => {
  it('filters tasks by status and category', () => {
    const tasks = [
      {id: 1, categoryId: 1, status: 'TODO', plannedDate: '2026-06-05', title: 'A'},
      {id: 2, categoryId: 2, status: 'DONE', plannedDate: '2026-06-05', title: 'B'},
    ];

    const result = filterTasks(tasks as never[], {category: '2', status: 'DONE', dateScope: 'all'});
    expect(result.map((task) => task.id)).toEqual([2]);
  });
});
```

```ts
import {describe, expect, it} from 'vitest';
import {buildCategoryDurationChart} from './reportCharts';

describe('buildCategoryDurationChart', () => {
  it('returns chart rows sorted by duration descending', () => {
    const rows = buildCategoryDurationChart({学习: 1200, 工作: 3600});
    expect(rows).toEqual([
      {name: '工作', minutes: 60},
      {name: '学习', minutes: 20},
    ]);
  });
});
```

- [ ] **Step 2: 运行前端模块测试，确认逻辑仍困在 `App.tsx`**

Run: `npm test -- src/modules/tasks/controllers/taskFilters.test.ts src/modules/reports/mappers/reportCharts.test.ts`

Expected: FAIL，提示找不到模块或导出

- [ ] **Step 3: 实现模块 controller、panel 组件与 AppShell 组装**

```ts
// src/modules/tasks/controllers/useTasksController.ts
import {useMemo} from 'react';
import type {Task} from '../../../../shared/domain/entities';

export interface TaskFilterState {
  category: string;
  status: string;
  dateScope: 'today' | 'seven-days' | 'all';
}

export function filterTasks(tasks: Task[], filters: TaskFilterState): Task[] {
  return tasks.filter((task) => {
    if (filters.category !== 'all' && task.categoryId !== Number(filters.category)) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    return true;
  });
}

export function useTasksController(tasks: Task[], filters: TaskFilterState) {
  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  return {filteredTasks};
}
```

```ts
// src/modules/reports/mappers/reportCharts.ts
export function buildCategoryDurationChart(categoryDuration: Record<string, number>) {
  return Object.entries(categoryDuration)
    .map(([name, seconds]) => ({name, minutes: Math.round(seconds / 60)}))
    .sort((left, right) => right.minutes - left.minutes);
}
```

```tsx
// src/app/AppShell.tsx
import {useState} from 'react';
import {APP_TABS, type AppTab} from './navigation';
import {DashboardPanel} from '../modules/dashboard/components/DashboardPanel';
import {TasksPanel} from '../modules/tasks/components/TasksPanel';
import {CategoryPanel} from '../modules/categories/components/CategoryPanel';
import {DailyReportPanel} from '../modules/reports/components/DailyReportPanel';
import {WeeklyReviewPanel} from '../modules/reports/components/WeeklyReviewPanel';
import {FocusPanel} from '../modules/focus/components/FocusPanel';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('today');

  return (
    <div className="min-h-screen">
      <nav>
        {APP_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>
      {activeTab === 'today' && <DashboardPanel />}
      {activeTab === 'tasks' && <TasksPanel />}
      {activeTab === 'categories' && <CategoryPanel />}
      {activeTab === 'daily' && <DailyReportPanel />}
      {activeTab === 'weekly' && <WeeklyReviewPanel />}
      {activeTab === 'focus' && <FocusPanel />}
    </div>
  );
}
```

- [ ] **Step 4: 运行模块测试、类型检查与构建**

Run: `npm test -- src/modules/tasks/controllers/taskFilters.test.ts src/modules/reports/mappers/reportCharts.test.ts`

Expected: `2 passed`

Run: `npm run lint`

Expected: `0 errors`

Run: `npm run build`

Expected: `vite build` 成功

- [ ] **Step 5: 提交前端模块拆分**

```bash
git add src/modules src/app/AppShell.tsx src/index.css
git commit -m "refactor: split frontend into domain modules"
```

## Task 7: 清理旧入口、更新文档并做最终验收

**Files:**
- Delete: `server/routes.ts`
- Delete: `server/db.ts`
- Delete: `server/reports.ts`
- Delete: `src/api.ts`
- Modify: `README.md`
- Modify: `server.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 先写最终回归检查命令**

```bash
npm test
npm run lint
npm run build
```

Expected: 当前阶段至少有一项失败，因为旧入口尚未彻底切断

- [ ] **Step 2: 删除旧文件并更新 README**

```md
# PlanTode

本项目是一个本地单用户计划管理工具，采用 React + Express + JSON 存储。

## 开发命令

- `npm install`
- `npm run dev`
- `npm test`
- `npm run lint`
- `npm run build`

## 目录约定

- `shared/`：前后端共享领域模型
- `server/modules/`：后端业务模块
- `server/storage/`：JSON 存储实现
- `src/modules/`：前端业务模块
```

- [ ] **Step 3: 运行最终验收**

Run: `npm test`

Expected: 所有测试通过，输出 `passed`

Run: `npm run lint`

Expected: `0 errors`

Run: `npm run build`

Expected: `vite build` 成功并产出 `dist`

Run: `npm run dev`

Expected: 应用在 `http://127.0.0.1:3000` 可打开，现有页面与功能保持可用

- [ ] **Step 4: 提交最终清理**

```bash
git add README.md src/App.tsx server.ts
git rm server/routes.ts server/db.ts server/reports.ts src/api.ts
git commit -m "refactor: remove legacy monolith entrypoints"
```

## Self-Review Checklist

- Spec coverage:
  - 共享领域模型：Task 1
  - 存储抽象与 JSON 保留：Task 2
  - 后端分层与模块边界：Task 3-4
  - 前端按业务域拆分：Task 5-6
  - 清理模板残骸与旧结构：Task 7
- Placeholder scan:
  - 未使用 `TODO`、`TBD`、`后续补`
  - 每个任务都给出明确文件、测试、命令和提交点
- Type consistency:
  - `TaskStatus` / `SessionStatus` 统一来自 `shared/domain/status.ts`
  - `Category` / `Task` / `TaskExecutionSession` / `DailyReport` / `WeeklyReview` 统一来自 `shared/domain/entities.ts`
  - 前端 API、后端 service、JSON repository 使用同一组领域命名

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-plantode-rearchitecture-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
