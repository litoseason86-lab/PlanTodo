# SQLite Dual Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `better-sqlite3` storage driver while keeping the current JSON storage driver available through environment-based runtime selection.

**Architecture:** Keep existing routes and services unchanged. Add SQLite repositories that implement the existing repository contracts, then move storage selection into a repository factory consumed by `server/app/registerRoutes.ts`. SQLite schema creation is handled by hand-written migrations that run when the SQLite client opens.

**Tech Stack:** TypeScript, Express, `better-sqlite3`, Vitest, JSON storage, SQLite file storage.

---

## File Structure Map

### Create

- `server/storage/createRepositories.ts`: chooses JSON or SQLite repositories from environment variables.
- `server/storage/createRepositories.test.ts`: verifies driver selection and invalid driver behavior.
- `server/storage/sqlite/sqliteClient.ts`: opens SQLite files, enables foreign keys, runs migrations.
- `server/storage/sqlite/sqliteClient.test.ts`: verifies schema creation and demo user seed.
- `server/storage/sqlite/migrations.ts`: stores and runs ordered SQL migrations.
- `server/storage/sqlite/repositories/categorySqliteRepository.ts`: SQLite implementation of `CategoryRepository`.
- `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`: category behavior parity tests.
- `server/storage/sqlite/repositories/taskSqliteRepository.ts`: SQLite implementation of `TaskRepository`.
- `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`: task behavior parity tests.
- `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`: SQLite implementation of `FocusSessionRepository`.
- `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`: focus session behavior parity tests.
- `server/storage/sqlite/repositories/reportSqliteRepository.ts`: SQLite implementation of `ReportRepository`.
- `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`: report upsert/get behavior tests.
- `server/storage/sqlite/repositories/rowMappers.ts`: maps SQLite snake_case rows to domain entities.
- `server/storage/sqlite/testUtils.ts`: creates temporary SQLite clients for repository tests.

### Modify

- `package.json`: add `better-sqlite3`, `@types/better-sqlite3`, and optional `db:sqlite` helper script.
- `package-lock.json`: dependency lockfile update.
- `.env.example`: document storage environment variables.
- `README.md`: document JSON/SQLite storage modes.
- `server/app/registerRoutes.ts`: use `createRepositoriesFromEnv()` instead of directly creating JSON repositories.

---

## Task 1: Add SQLite Dependency And Storage Factory Skeleton

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/storage/createRepositories.ts`
- Test: `server/storage/createRepositories.test.ts`

- [ ] **Step 1: Write the failing factory tests**

Create `server/storage/createRepositories.test.ts`:

```ts
import {afterEach, describe, expect, it, vi} from 'vitest';

import {createRepositoriesFromEnv} from './createRepositories';

const originalEnv = {...process.env};

afterEach(() => {
  process.env = {...originalEnv};
  vi.restoreAllMocks();
});

describe('createRepositoriesFromEnv', () => {
  it('defaults to JSON repositories when STORAGE_DRIVER is not set', () => {
    delete process.env.STORAGE_DRIVER;
    process.env.JSON_DB_PATH = 'data/test-db.json';

    const repositories = createRepositoriesFromEnv();

    expect(repositories.driver).toBe('json');
    expect(repositories.categories.constructor.name).toBe('CategoryJsonRepository');
    expect(repositories.tasks.constructor.name).toBe('TaskJsonRepository');
    expect(repositories.focusSessions.constructor.name).toBe('FocusSessionJsonRepository');
    expect(repositories.reports.constructor.name).toBe('ReportJsonRepository');
  });

  it('rejects unknown storage drivers', () => {
    process.env.STORAGE_DRIVER = 'postgres';

    expect(() => createRepositoriesFromEnv()).toThrow('Unsupported STORAGE_DRIVER "postgres". Use "json" or "sqlite".');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
```

Expected: FAIL with `Cannot find module './createRepositories'`.

- [ ] **Step 3: Install SQLite dependencies**

Run:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

Expected: `package.json` and `package-lock.json` include the new dependencies.

- [ ] **Step 4: Implement the JSON-only factory skeleton**

Create `server/storage/createRepositories.ts`:

```ts
import path from 'node:path';

import type {CategoryRepository} from '../modules/categories/repository';
import type {FocusSessionRepository} from '../modules/focus/repository';
import type {ReportRepository} from '../modules/reports/repository';
import type {TaskRepository} from '../modules/tasks/repository';
import {CategoryJsonRepository} from './json/repositories/categoryJsonRepository';
import {FocusSessionJsonRepository} from './json/repositories/focusSessionJsonRepository';
import {ReportJsonRepository} from './json/repositories/reportJsonRepository';
import {TaskJsonRepository} from './json/repositories/taskJsonRepository';
import {JsonFileStore} from './json/fileStore';

export type StorageDriver = 'json' | 'sqlite';

export interface AppRepositories {
  driver: StorageDriver;
  categories: CategoryRepository;
  tasks: TaskRepository;
  focusSessions: FocusSessionRepository;
  reports: ReportRepository;
}

function resolveStorageDriver(value: string | undefined): StorageDriver {
  if (!value || value === 'json') {
    return 'json';
  }
  if (value === 'sqlite') {
    return 'sqlite';
  }
  throw new Error(`Unsupported STORAGE_DRIVER "${value}". Use "json" or "sqlite".`);
}

function createJsonRepositories(filePath: string): AppRepositories {
  const store = new JsonFileStore(filePath);

  return {
    driver: 'json',
    categories: new CategoryJsonRepository(store),
    tasks: new TaskJsonRepository(store),
    focusSessions: new FocusSessionJsonRepository(store),
    reports: new ReportJsonRepository(store),
  };
}

export function createRepositoriesFromEnv(env: NodeJS.ProcessEnv = process.env): AppRepositories {
  const driver = resolveStorageDriver(env.STORAGE_DRIVER);
  if (driver === 'json') {
    return createJsonRepositories(path.resolve(env.JSON_DB_PATH ?? 'data/db.json'));
  }

  throw new Error('SQLite storage is not implemented yet.');
}
```

- [ ] **Step 5: Run the factory test**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
```

Expected: PASS for the JSON default and invalid driver tests.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json package-lock.json server/storage/createRepositories.ts server/storage/createRepositories.test.ts
git commit -m "feat: add storage repository factory"
```

---

## Task 2: Add SQLite Client And Migrations

**Files:**
- Create: `server/storage/sqlite/migrations.ts`
- Create: `server/storage/sqlite/sqliteClient.ts`
- Test: `server/storage/sqlite/sqliteClient.test.ts`

- [ ] **Step 1: Write the failing SQLite client test**

Create `server/storage/sqlite/sqliteClient.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from './sqliteClient';

const createdFiles: string[] = [];

function tempDbPath(): string {
  const filePath = path.join(os.tmpdir(), `plantode-sqlite-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  createdFiles.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const filePath of createdFiles.splice(0)) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe('openSqliteClient', () => {
  it('creates schema and seeds the fixed demo user', () => {
    const client = openSqliteClient(tempDbPath());

    const tables = client
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all() as Array<{name: string}>;
    const tableNames = tables.map((table) => table.name);

    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('task_execution_sessions');
    expect(tableNames).toContain('daily_reports');
    expect(tableNames).toContain('weekly_reviews');

    const user = client.prepare('select id, username, display_name from users where id = 1').get();
    expect(user).toEqual({
      id: 1,
      username: 'demo',
      display_name: 'Demo User',
    });

    const migrationCount = client.prepare('select count(*) as count from schema_migrations').get() as {count: number};
    expect(migrationCount.count).toBeGreaterThan(0);

    client.close();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/sqlite/sqliteClient.test.ts
```

Expected: FAIL with `Cannot find module './sqliteClient'`.

- [ ] **Step 3: Implement migrations**

Create `server/storage/sqlite/migrations.ts`:

```ts
import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_schema',
    sql: `
      create table if not exists schema_migrations (
        version integer primary key,
        name text not null,
        executed_at text not null
      );

      create table if not exists users (
        id integer primary key,
        username text not null,
        display_name text not null,
        created_at text not null
      );

      insert into users (id, username, display_name, created_at)
      values (1, 'demo', 'Demo User', datetime('now'))
      on conflict(id) do nothing;

      create table if not exists categories (
        id integer primary key,
        user_id integer not null,
        name text not null,
        color text not null,
        sort_order integer not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id)
      );

      create table if not exists tasks (
        id integer primary key,
        user_id integer not null,
        category_id integer not null,
        title text not null,
        planned_date text not null,
        status text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        foreign key (category_id) references categories(id)
      );

      create index if not exists idx_tasks_user_planned_date on tasks(user_id, planned_date);
      create index if not exists idx_tasks_user_status on tasks(user_id, status);
      create index if not exists idx_tasks_user_category on tasks(user_id, category_id);

      create table if not exists task_execution_sessions (
        id integer primary key,
        task_id integer not null,
        user_id integer not null,
        started_at text not null,
        ended_at text,
        duration_seconds integer,
        status text not null,
        created_at text not null,
        task_title text,
        foreign key (task_id) references tasks(id),
        foreign key (user_id) references users(id)
      );

      create index if not exists idx_sessions_user_status on task_execution_sessions(user_id, status);
      create index if not exists idx_sessions_user_started_at on task_execution_sessions(user_id, started_at);
      create index if not exists idx_sessions_task on task_execution_sessions(task_id);

      create table if not exists daily_reports (
        id integer primary key,
        user_id integer not null,
        report_date text not null,
        content text not null,
        generator_type text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        unique(user_id, report_date)
      );

      create table if not exists weekly_reviews (
        id integer primary key,
        user_id integer not null,
        week_start_date text not null,
        week_end_date text not null,
        content text not null,
        generator_type text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        unique(user_id, week_start_date)
      );
    `,
  },
];

export function runMigrations(database: Database.Database): void {
  database.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      executed_at text not null
    );
  `);

  const hasMigration = database.prepare('select 1 from schema_migrations where version = ?');
  const insertMigration = database.prepare(
    'insert into schema_migrations (version, name, executed_at) values (?, ?, ?)',
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.version)) {
      continue;
    }

    const execute = database.transaction(() => {
      database.exec(migration.sql);
      insertMigration.run(migration.version, migration.name, new Date().toISOString());
    });

    execute();
  }
}
```

- [ ] **Step 4: Implement SQLite client**

Create `server/storage/sqlite/sqliteClient.ts`:

```ts
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

import {runMigrations} from './migrations';

export function openSqliteClient(filePath: string): Database.Database {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {recursive: true});
  }

  const database = new Database(filePath);
  database.pragma('foreign_keys = ON');
  runMigrations(database);

  return database;
}
```

- [ ] **Step 5: Run the SQLite client test**

Run:

```bash
npm test -- server/storage/sqlite/sqliteClient.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add server/storage/sqlite/migrations.ts server/storage/sqlite/sqliteClient.ts server/storage/sqlite/sqliteClient.test.ts
git commit -m "feat: add sqlite client migrations"
```

---

## Task 3: Add SQLite Row Mappers And Test Utilities

**Files:**
- Create: `server/storage/sqlite/repositories/rowMappers.ts`
- Create: `server/storage/sqlite/testUtils.ts`
- Test: covered by Task 4-7 repository tests.

- [ ] **Step 1: Create row mappers**

Create `server/storage/sqlite/repositories/rowMappers.ts`:

```ts
import type {
  Category,
  DailyReport,
  Task,
  TaskExecutionSession,
  WeeklyReview,
} from '../../../../shared/domain/entities';
import type {ReportGeneratorType, SessionStatus, TaskStatus} from '../../../../shared/domain/status';

export interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: number;
  user_id: number;
  category_id: number;
  title: string;
  planned_date: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface FocusSessionRow {
  id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: SessionStatus;
  created_at: string;
  task_title: string | null;
}

export interface DailyReportRow {
  id: number;
  user_id: number;
  report_date: string;
  content: string;
  generator_type: ReportGeneratorType;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReviewRow {
  id: number;
  user_id: number;
  week_start_date: string;
  week_end_date: string;
  content: string;
  generator_type: ReportGeneratorType;
  created_at: string;
  updated_at: string;
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    plannedDate: row.planned_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFocusSessionRow(row: FocusSessionRow): TaskExecutionSession {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    taskTitle: row.task_title ?? undefined,
  };
}

export function mapDailyReportRow(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    userId: row.user_id,
    reportDate: row.report_date,
    content: row.content,
    generatorType: row.generator_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWeeklyReviewRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    userId: row.user_id,
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    content: row.content,
    generatorType: row.generator_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 2: Create SQLite test utilities**

Create `server/storage/sqlite/testUtils.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';

import {openSqliteClient} from './sqliteClient';

export interface TestSqliteClient {
  database: Database.Database;
  filePath: string;
  cleanup: () => void;
}

export function createTestSqliteClient(): TestSqliteClient {
  const filePath = path.join(os.tmpdir(), `plantode-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  const database = openSqliteClient(filePath);

  return {
    database,
    filePath,
    cleanup() {
      database.close();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },
  };
}
```

- [ ] **Step 3: Run type check**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add server/storage/sqlite/repositories/rowMappers.ts server/storage/sqlite/testUtils.ts
git commit -m "feat: add sqlite row mapping helpers"
```

---

## Task 4: Implement Category SQLite Repository

**Files:**
- Create: `server/storage/sqlite/repositories/categorySqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`

- [ ] **Step 1: Write failing category repository tests**

Create `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createTestSqliteClient, type TestSqliteClient} from '../testUtils';
import {CategorySqliteRepository} from './categorySqliteRepository';

let client: TestSqliteClient;

beforeEach(() => {
  client = createTestSqliteClient();
});

afterEach(() => {
  client.cleanup();
});

describe('CategorySqliteRepository', () => {
  it('creates, lists, finds, updates, checks names, and removes categories', () => {
    const repository = new CategorySqliteRepository(client.database);

    const first = repository.create({
      userId: 1,
      name: '工作',
      color: '#ef4444',
      sortOrder: 20,
    });
    const second = repository.create({
      userId: 1,
      name: '生活',
      color: '#22c55e',
      sortOrder: 10,
    });

    expect(first.id).toBe(1);
    expect(repository.existsByName(1, ' 工作 ')).toBe(true);
    expect(repository.existsByName(1, '不存在')).toBe(false);
    expect(repository.getById(first.id, 1)?.name).toBe('工作');
    expect(repository.listByUser(1).map((category) => category.name)).toEqual(['生活', '工作']);

    const updated = repository.update({
      id: second.id,
      userId: 1,
      name: '健康',
      color: '#0ea5e9',
      sortOrder: 5,
    });

    expect(updated?.name).toBe('健康');
    expect(updated?.updatedAt).not.toBe(second.updatedAt);
    expect(repository.remove(first.id, 1)).toBe(true);
    expect(repository.getById(first.id, 1)).toBeUndefined();
    expect(repository.remove(999, 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/sqlite/repositories/categorySqliteRepository.test.ts
```

Expected: FAIL with `Cannot find module './categorySqliteRepository'`.

- [ ] **Step 3: Implement category repository**

Create `server/storage/sqlite/repositories/categorySqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../../modules/categories/repository';
import type {Category} from '../../../../shared/domain/entities';
import {mapCategoryRow, type CategoryRow} from './rowMappers';

export class CategorySqliteRepository implements CategoryRepository {
  constructor(private readonly database: Database.Database) {}

  listByUser(userId: number): Category[] {
    const rows = this.database
      .prepare(
        `
          select id, user_id, name, color, sort_order, created_at, updated_at
          from categories
          where user_id = ?
          order by sort_order asc, name asc
        `,
      )
      .all(userId) as CategoryRow[];

    return rows.map(mapCategoryRow);
  }

  getById(id: number, userId: number): Category | undefined {
    const row = this.database
      .prepare(
        `
          select id, user_id, name, color, sort_order, created_at, updated_at
          from categories
          where id = ? and user_id = ?
        `,
      )
      .get(id, userId) as CategoryRow | undefined;

    return row ? mapCategoryRow(row) : undefined;
  }

  existsByName(userId: number, name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    const row = this.database
      .prepare('select 1 from categories where user_id = ? and lower(trim(name)) = ? limit 1')
      .get(userId, normalizedName);

    return Boolean(row);
  }

  create(input: CreateCategoryInput): Category {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `
          insert into categories (user_id, name, color, sort_order, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(input.userId, input.name.trim(), input.color || '#64748b', input.sortOrder, now, now);

    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  update(input: UpdateCategoryInput): Category | undefined {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `
          update categories
          set name = ?, color = ?, sort_order = ?, updated_at = ?
          where id = ? and user_id = ?
        `,
      )
      .run(input.name.trim(), input.color || '#64748b', input.sortOrder, now, input.id, input.userId);

    if (result.changes === 0) {
      return undefined;
    }

    return this.getById(input.id, input.userId);
  }

  remove(id: number, userId: number): boolean {
    const result = this.database
      .prepare('delete from categories where id = ? and user_id = ?')
      .run(id, userId);

    return result.changes > 0;
  }
}
```

- [ ] **Step 4: Run the category repository test**

Run:

```bash
npm test -- server/storage/sqlite/repositories/categorySqliteRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add server/storage/sqlite/repositories/categorySqliteRepository.ts server/storage/sqlite/repositories/categorySqliteRepository.test.ts
git commit -m "feat: add sqlite category repository"
```

---

## Task 5: Implement Task SQLite Repository

**Files:**
- Create: `server/storage/sqlite/repositories/taskSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`

- [ ] **Step 1: Write failing task repository tests**

Create `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createTestSqliteClient, type TestSqliteClient} from '../testUtils';
import {CategorySqliteRepository} from './categorySqliteRepository';
import {TaskSqliteRepository} from './taskSqliteRepository';

let client: TestSqliteClient;

beforeEach(() => {
  client = createTestSqliteClient();
});

afterEach(() => {
  client.cleanup();
});

describe('TaskSqliteRepository', () => {
  it('creates, filters, retrieves, and updates task status', () => {
    const categories = new CategorySqliteRepository(client.database);
    const tasks = new TaskSqliteRepository(client.database);
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});

    const first = tasks.create({
      userId: 1,
      categoryId: category.id,
      title: '写方案',
      plannedDate: '2026-06-05',
    });
    tasks.create({
      userId: 1,
      categoryId: category.id,
      title: '复盘',
      plannedDate: '2026-06-06',
    });

    expect(first.id).toBe(1);
    expect(first.status).toBe('TODO');
    expect(tasks.getById(first.id, 1)?.title).toBe('写方案');
    expect(tasks.listByFilters({userId: 1, plannedDate: '2026-06-05'}).map((task) => task.title)).toEqual(['写方案']);
    expect(tasks.listByFilters({userId: 1, categoryId: category.id}).length).toBe(2);

    const updated = tasks.updateStatus(first.id, 1, 'DONE');
    expect(updated?.status).toBe('DONE');
    expect(tasks.listByFilters({userId: 1, status: 'DONE'}).map((task) => task.id)).toEqual([first.id]);
    expect(tasks.updateStatus(999, 1, 'DONE')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: FAIL with `Cannot find module './taskSqliteRepository'`.

- [ ] **Step 3: Implement task repository**

Create `server/storage/sqlite/repositories/taskSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {mapTaskRow, type TaskRow} from './rowMappers';

export class TaskSqliteRepository implements TaskRepository {
  constructor(private readonly database: Database.Database) {}

  listByFilters(filters: TaskFilters): Task[] {
    const conditions = ['user_id = ?'];
    const values: Array<number | string> = [filters.userId];

    if (filters.plannedDate) {
      conditions.push('planned_date = ?');
      values.push(filters.plannedDate);
    }
    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }
    if (filters.categoryId) {
      conditions.push('category_id = ?');
      values.push(filters.categoryId);
    }

    const rows = this.database
      .prepare(
        `
          select id, user_id, category_id, title, planned_date, status, created_at, updated_at
          from tasks
          where ${conditions.join(' and ')}
          order by created_at asc
        `,
      )
      .all(...values) as TaskRow[];

    return rows.map(mapTaskRow);
  }

  getById(taskId: number, userId: number): Task | undefined {
    const row = this.database
      .prepare(
        `
          select id, user_id, category_id, title, planned_date, status, created_at, updated_at
          from tasks
          where id = ? and user_id = ?
        `,
      )
      .get(taskId, userId) as TaskRow | undefined;

    return row ? mapTaskRow(row) : undefined;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `
          insert into tasks (user_id, category_id, title, planned_date, status, created_at, updated_at)
          values (?, ?, ?, ?, 'TODO', ?, ?)
        `,
      )
      .run(input.userId, input.categoryId, input.title.trim(), input.plannedDate, now, now);

    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `
          update tasks
          set status = ?, updated_at = ?
          where id = ? and user_id = ?
        `,
      )
      .run(status, now, taskId, userId);

    if (result.changes === 0) {
      return undefined;
    }

    return this.getById(taskId, userId);
  }
}
```

- [ ] **Step 4: Run the task repository test**

Run:

```bash
npm test -- server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add server/storage/sqlite/repositories/taskSqliteRepository.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
git commit -m "feat: add sqlite task repository"
```

---

## Task 6: Implement Focus Session SQLite Repository

**Files:**
- Create: `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`

- [ ] **Step 1: Write failing focus session tests**

Create `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createTestSqliteClient, type TestSqliteClient} from '../testUtils';
import {CategorySqliteRepository} from './categorySqliteRepository';
import {FocusSessionSqliteRepository} from './focusSessionSqliteRepository';
import {TaskSqliteRepository} from './taskSqliteRepository';

let client: TestSqliteClient;

beforeEach(() => {
  client = createTestSqliteClient();
});

afterEach(() => {
  client.cleanup();
});

describe('FocusSessionSqliteRepository', () => {
  it('creates, queries, and stops running sessions', () => {
    const categories = new CategorySqliteRepository(client.database);
    const tasks = new TaskSqliteRepository(client.database);
    const sessions = new FocusSessionSqliteRepository(client.database);
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const task = tasks.create({userId: 1, categoryId: category.id, title: '写方案', plannedDate: '2026-06-05'});

    const running = sessions.createRunning({
      userId: 1,
      taskId: task.id,
      startedAt: '2026-06-05T01:00:00.000Z',
    });

    expect(running.status).toBe('RUNNING');
    expect(sessions.getRunningByUser(1)?.id).toBe(running.id);
    expect(sessions.listByTask(task.id, 1).map((session) => session.id)).toEqual([running.id]);
    expect(sessions.listByDateRange(1, '2026-06-05T00:00:00.000Z', '2026-06-05T23:59:59.999Z')).toHaveLength(1);

    const stopped = sessions.stop({
      userId: 1,
      sessionId: running.id,
      endedAt: '2026-06-05T01:30:00.000Z',
    });

    expect(stopped?.status).toBe('COMPLETED');
    expect(stopped?.durationSeconds).toBe(1800);
    expect(sessions.getRunningByUser(1)).toBeUndefined();
    expect(sessions.stop({userId: 1, sessionId: running.id})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts
```

Expected: FAIL with `Cannot find module './focusSessionSqliteRepository'`.

- [ ] **Step 3: Implement focus session repository**

Create `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {
  CreateRunningSessionInput,
  FocusSessionRepository,
  StopSessionInput,
} from '../../../modules/focus/repository';
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {mapFocusSessionRow, type FocusSessionRow} from './rowMappers';

function calculateDurationSeconds(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
}

export class FocusSessionSqliteRepository implements FocusSessionRepository {
  constructor(private readonly database: Database.Database) {}

  getRunningByUser(userId: number): TaskExecutionSession | undefined {
    const row = this.database
      .prepare(
        `
          select id, task_id, user_id, started_at, ended_at, duration_seconds, status, created_at, task_title
          from task_execution_sessions
          where user_id = ? and status = 'RUNNING'
          limit 1
        `,
      )
      .get(userId) as FocusSessionRow | undefined;

    return row ? mapFocusSessionRow(row) : undefined;
  }

  listByTask(taskId: number, userId: number): TaskExecutionSession[] {
    const rows = this.database
      .prepare(
        `
          select id, task_id, user_id, started_at, ended_at, duration_seconds, status, created_at, task_title
          from task_execution_sessions
          where task_id = ? and user_id = ?
          order by started_at desc
        `,
      )
      .all(taskId, userId) as FocusSessionRow[];

    return rows.map(mapFocusSessionRow);
  }

  listByDateRange(userId: number, startAt: string, endAt: string): TaskExecutionSession[] {
    const rows = this.database
      .prepare(
        `
          select id, task_id, user_id, started_at, ended_at, duration_seconds, status, created_at, task_title
          from task_execution_sessions
          where user_id = ? and started_at >= ? and started_at <= ?
          order by started_at asc
        `,
      )
      .all(userId, startAt, endAt) as FocusSessionRow[];

    return rows.map(mapFocusSessionRow);
  }

  createRunning(input: CreateRunningSessionInput): TaskExecutionSession {
    const startedAt = input.startedAt ?? new Date().toISOString();
    const result = this.database
      .prepare(
        `
          insert into task_execution_sessions (task_id, user_id, started_at, status, created_at)
          values (?, ?, ?, 'RUNNING', ?)
        `,
      )
      .run(input.taskId, input.userId, startedAt, startedAt);

    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  stop(input: StopSessionInput): TaskExecutionSession | undefined {
    const existing = this.getById(input.sessionId, input.userId);
    if (!existing || existing.status !== 'RUNNING') {
      return undefined;
    }

    const endedAt = input.endedAt ?? new Date().toISOString();
    const durationSeconds = calculateDurationSeconds(existing.startedAt, endedAt);
    this.database
      .prepare(
        `
          update task_execution_sessions
          set ended_at = ?, duration_seconds = ?, status = 'COMPLETED'
          where id = ? and user_id = ? and status = 'RUNNING'
        `,
      )
      .run(endedAt, durationSeconds, input.sessionId, input.userId);

    return this.getById(input.sessionId, input.userId);
  }

  private getById(sessionId: number, userId: number): TaskExecutionSession | undefined {
    const row = this.database
      .prepare(
        `
          select id, task_id, user_id, started_at, ended_at, duration_seconds, status, created_at, task_title
          from task_execution_sessions
          where id = ? and user_id = ?
        `,
      )
      .get(sessionId, userId) as FocusSessionRow | undefined;

    return row ? mapFocusSessionRow(row) : undefined;
  }
}
```

- [ ] **Step 4: Run the focus session test**

Run:

```bash
npm test -- server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add server/storage/sqlite/repositories/focusSessionSqliteRepository.ts server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts
git commit -m "feat: add sqlite focus session repository"
```

---

## Task 7: Implement Report SQLite Repository

**Files:**
- Create: `server/storage/sqlite/repositories/reportSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`

- [ ] **Step 1: Write failing report repository tests**

Create `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`:

```ts
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createTestSqliteClient, type TestSqliteClient} from '../testUtils';
import {ReportSqliteRepository} from './reportSqliteRepository';

let client: TestSqliteClient;

beforeEach(() => {
  client = createTestSqliteClient();
});

afterEach(() => {
  client.cleanup();
});

describe('ReportSqliteRepository', () => {
  it('saves and updates daily reports', () => {
    const repository = new ReportSqliteRepository(client.database);

    const created = repository.saveDaily(1, '2026-06-05', 'first');
    const updated = repository.saveDaily(1, '2026-06-05', 'second');

    expect(created.id).toBe(updated.id);
    expect(updated.content).toBe('second');
    expect(repository.getDaily(1, '2026-06-05')?.content).toBe('second');
  });

  it('saves and updates weekly reviews', () => {
    const repository = new ReportSqliteRepository(client.database);

    const created = repository.saveWeekly(1, '2026-06-01', '2026-06-07', 'first');
    const updated = repository.saveWeekly(1, '2026-06-01', '2026-06-08', 'second');

    expect(created.id).toBe(updated.id);
    expect(updated.content).toBe('second');
    expect(updated.weekEndDate).toBe('2026-06-08');
    expect(repository.getWeekly(1, '2026-06-01')?.content).toBe('second');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- server/storage/sqlite/repositories/reportSqliteRepository.test.ts
```

Expected: FAIL with `Cannot find module './reportSqliteRepository'`.

- [ ] **Step 3: Implement report repository**

Create `server/storage/sqlite/repositories/reportSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {ReportRepository} from '../../../modules/reports/repository';
import type {DailyReport, WeeklyReview} from '../../../../shared/domain/entities';
import {
  mapDailyReportRow,
  mapWeeklyReviewRow,
  type DailyReportRow,
  type WeeklyReviewRow,
} from './rowMappers';

export class ReportSqliteRepository implements ReportRepository {
  constructor(private readonly database: Database.Database) {}

  getDaily(userId: number, reportDate: string): DailyReport | undefined {
    const row = this.database
      .prepare(
        `
          select id, user_id, report_date, content, generator_type, created_at, updated_at
          from daily_reports
          where user_id = ? and report_date = ?
        `,
      )
      .get(userId, reportDate) as DailyReportRow | undefined;

    return row ? mapDailyReportRow(row) : undefined;
  }

  saveDaily(userId: number, reportDate: string, content: string): DailyReport {
    const now = new Date().toISOString();
    const existing = this.getDaily(userId, reportDate);
    if (existing) {
      this.database
        .prepare('update daily_reports set content = ?, updated_at = ? where id = ?')
        .run(content, now, existing.id);
      return this.getDaily(userId, reportDate)!;
    }

    this.database
      .prepare(
        `
          insert into daily_reports (user_id, report_date, content, generator_type, created_at, updated_at)
          values (?, ?, ?, 'RULE_BASED', ?, ?)
        `,
      )
      .run(userId, reportDate, content, now, now);

    return this.getDaily(userId, reportDate)!;
  }

  getWeekly(userId: number, weekStartDate: string): WeeklyReview | undefined {
    const row = this.database
      .prepare(
        `
          select id, user_id, week_start_date, week_end_date, content, generator_type, created_at, updated_at
          from weekly_reviews
          where user_id = ? and week_start_date = ?
        `,
      )
      .get(userId, weekStartDate) as WeeklyReviewRow | undefined;

    return row ? mapWeeklyReviewRow(row) : undefined;
  }

  saveWeekly(userId: number, weekStartDate: string, weekEndDate: string, content: string): WeeklyReview {
    const now = new Date().toISOString();
    const existing = this.getWeekly(userId, weekStartDate);
    if (existing) {
      this.database
        .prepare('update weekly_reviews set week_end_date = ?, content = ?, updated_at = ? where id = ?')
        .run(weekEndDate, content, now, existing.id);
      return this.getWeekly(userId, weekStartDate)!;
    }

    this.database
      .prepare(
        `
          insert into weekly_reviews (user_id, week_start_date, week_end_date, content, generator_type, created_at, updated_at)
          values (?, ?, ?, ?, 'RULE_BASED', ?, ?)
        `,
      )
      .run(userId, weekStartDate, weekEndDate, content, now, now);

    return this.getWeekly(userId, weekStartDate)!;
  }
}
```

- [ ] **Step 4: Run report repository tests**

Run:

```bash
npm test -- server/storage/sqlite/repositories/reportSqliteRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add server/storage/sqlite/repositories/reportSqliteRepository.ts server/storage/sqlite/repositories/reportSqliteRepository.test.ts
git commit -m "feat: add sqlite report repository"
```

---

## Task 8: Wire SQLite Driver Into Runtime

**Files:**
- Modify: `server/storage/createRepositories.ts`
- Modify: `server/app/registerRoutes.ts`
- Test: `server/storage/createRepositories.test.ts`

- [ ] **Step 1: Extend factory tests for SQLite driver**

Modify `server/storage/createRepositories.test.ts` to add:

```ts
it('creates SQLite repositories when STORAGE_DRIVER is sqlite', () => {
  process.env.STORAGE_DRIVER = 'sqlite';
  process.env.SQLITE_DB_PATH = ':memory:';

  const repositories = createRepositoriesFromEnv();

  expect(repositories.driver).toBe('sqlite');
  expect(repositories.categories.constructor.name).toBe('CategorySqliteRepository');
  expect(repositories.tasks.constructor.name).toBe('TaskSqliteRepository');
  expect(repositories.focusSessions.constructor.name).toBe('FocusSessionSqliteRepository');
  expect(repositories.reports.constructor.name).toBe('ReportSqliteRepository');
});
```

- [ ] **Step 2: Run factory tests and verify SQLite case fails**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
```

Expected: FAIL with `SQLite storage is not implemented yet.`

- [ ] **Step 3: Implement SQLite factory branch**

Modify `server/storage/createRepositories.ts`:

```ts
import {openSqliteClient} from './sqlite/sqliteClient';
import {CategorySqliteRepository} from './sqlite/repositories/categorySqliteRepository';
import {FocusSessionSqliteRepository} from './sqlite/repositories/focusSessionSqliteRepository';
import {ReportSqliteRepository} from './sqlite/repositories/reportSqliteRepository';
import {TaskSqliteRepository} from './sqlite/repositories/taskSqliteRepository';
```

Add:

```ts
function createSqliteRepositories(filePath: string): AppRepositories {
  const database = openSqliteClient(filePath);

  return {
    driver: 'sqlite',
    categories: new CategorySqliteRepository(database),
    tasks: new TaskSqliteRepository(database),
    focusSessions: new FocusSessionSqliteRepository(database),
    reports: new ReportSqliteRepository(database),
  };
}
```

Replace the SQLite branch:

```ts
return createSqliteRepositories(path.resolve(env.SQLITE_DB_PATH ?? 'data/plantode.sqlite'));
```

For `:memory:`, use:

```ts
const sqlitePath = env.SQLITE_DB_PATH ?? 'data/plantode.sqlite';
return createSqliteRepositories(sqlitePath === ':memory:' ? sqlitePath : path.resolve(sqlitePath));
```

- [ ] **Step 4: Modify route registration**

Modify `server/app/registerRoutes.ts` to replace direct JSON construction with factory usage:

```ts
import {createRepositoriesFromEnv} from '../storage/createRepositories';
```

Then:

```ts
export function registerRoutes(): Router {
  const router = Router();
  const repositories = createRepositoriesFromEnv();

  const categoriesService = new CategoriesService(repositories.categories, repositories.tasks);
  const tasksService = new TasksService(repositories.tasks, repositories.categories, repositories.focusSessions);
  const focusService = new FocusService(repositories.tasks, repositories.focusSessions);
  const reportsService = new ReportsService(
    repositories.reports,
    repositories.tasks,
    repositories.categories,
    repositories.focusSessions,
  );

  router.use(buildCategoryRoutes(categoriesService));
  router.use(buildTaskRoutes(tasksService));
  router.use(buildFocusRoutes(focusService));
  router.use(buildReportRoutes(reportsService));

  return router;
}
```

Remove JSON-specific imports from `registerRoutes.ts`.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
npm run lint
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add server/storage/createRepositories.ts server/storage/createRepositories.test.ts server/app/registerRoutes.ts
git commit -m "feat: wire sqlite storage driver"
```

---

## Task 9: Document Storage Configuration

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Update `.env.example`**

Append:

```txt
# Storage driver: json or sqlite
STORAGE_DRIVER=json
JSON_DB_PATH=data/db.json
SQLITE_DB_PATH=data/plantode.sqlite
```

- [ ] **Step 2: Add helper script**

Modify `package.json` scripts:

```json
"dev:sqlite": "STORAGE_DRIVER=sqlite SQLITE_DB_PATH=data/plantode.sqlite tsx server.ts"
```

- [ ] **Step 3: Update README storage section**

Add:

```md
## Storage Modes

PlanTode supports two local storage drivers:

- `json`: stores data in `data/db.json`
- `sqlite`: stores data in `data/plantode.sqlite`

JSON is the default:

```bash
npm run dev
```

SQLite can be enabled with:

```bash
npm run dev:sqlite
```

Or manually:

```bash
STORAGE_DRIVER=sqlite SQLITE_DB_PATH=data/plantode.sqlite npm run dev
```

The SQLite driver creates its schema automatically on startup. JSON-to-SQLite data import is not part of this release.
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit Task 9**

```bash
git add .env.example README.md package.json package-lock.json
git commit -m "docs: document sqlite storage mode"
```

---

## Task 10: Manual SQLite Runtime Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Start server with SQLite**

Run:

```bash
STORAGE_DRIVER=sqlite SQLITE_DB_PATH=data/test-plantode.sqlite npm run dev
```

Expected: server logs `Running on http://127.0.0.1:3000`.

- [ ] **Step 2: Verify basic API endpoints**

In another shell:

```bash
curl -s http://127.0.0.1:3000/api/categories
curl -s http://127.0.0.1:3000/api/tasks
curl -s http://127.0.0.1:3000/api/task-sessions/running
```

Expected:

```txt
[]
[]
{"session":null}
```

- [ ] **Step 3: Stop the dev server**

Press `Ctrl-C`.

- [ ] **Step 4: Remove manual test database**

Run:

```bash
rm -f data/test-plantode.sqlite
```

- [ ] **Step 5: Final full verification**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 6: Commit runtime verification note if files changed**

Run:

```bash
git status --short
```

Expected: clean. If only runtime database files appear, remove them instead of committing them.

