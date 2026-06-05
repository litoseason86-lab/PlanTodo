# SQLite 双存储 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `better-sqlite3` 存储实现，并通过环境变量在 JSON 与 SQLite repository 之间切换。

**Architecture:** 保留现有 repository contracts 和 JSON repositories。新增 `server/storage/sqlite` 实现同一批 contracts，并用 `server/storage/createRepositories.ts` 统一装配。`routes` 和 `services` 不接触 SQLite client，也不改变现有 API 行为。

**Tech Stack:** TypeScript, Express, better-sqlite3, Vitest, JSON storage fallback, hand-written SQLite migrations

---

## File Structure Map

### Create

- `server/storage/createRepositories.ts`：按环境变量创建 JSON 或 SQLite repositories。
- `server/storage/createRepositories.test.ts`：验证 driver 默认值、JSON 装配、SQLite 装配和非法 driver。
- `server/storage/sqlite/sqliteClient.ts`：创建 SQLite 目录、打开连接、开启外键、执行 migrations。
- `server/storage/sqlite/sqliteClient.test.ts`：验证 migration 建表、默认 demo user、migration 幂等。
- `server/storage/sqlite/migrations.ts`：手写 schema migrations。
- `server/storage/sqlite/repositories/categorySqliteRepository.ts`：实现 `CategoryRepository`。
- `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`：覆盖分类列表、查询、名称存在、创建、更新、删除。
- `server/storage/sqlite/repositories/taskSqliteRepository.ts`：实现 `TaskRepository`。
- `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`：覆盖任务创建、筛选、状态更新、按 ID 查询。
- `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`：实现 `FocusSessionRepository`。
- `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`：覆盖运行中 session、按任务、按日期范围、停止 session。
- `server/storage/sqlite/repositories/reportSqliteRepository.ts`：实现 `ReportRepository`。
- `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`：覆盖日报、周报的新增、更新、读取。
- `server/storage/sqlite/repositories/rowMappers.ts`：集中 snake_case row 到 domain entity 的转换。
- `server/storage/sqlite/testSqlite.ts`：测试用临时 SQLite 文件工具。

### Modify

- `package.json`：增加 `better-sqlite3`、`@types/better-sqlite3`。
- `package-lock.json`：随 `npm install` 更新。
- `.env.example`：增加 `STORAGE_DRIVER`、`JSON_DB_PATH`、`SQLITE_DB_PATH`。
- `README.md`：补充双存储配置说明。
- `server/app/registerRoutes.ts`：改为通过 `createRepositoriesFromEnv()` 获取 repositories。

---

## Task 1: 依赖和测试工具

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/storage/sqlite/testSqlite.ts`

- [ ] **Step 1: 安装 SQLite 依赖**

Run:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

Expected: `package.json` 出现：

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

实际版本以 npm 解析结果为准，不手写锁定版本。

- [ ] **Step 2: 创建测试 SQLite 文件工具**

Create `server/storage/sqlite/testSqlite.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TestSqliteFile {
  filePath: string;
  cleanup: () => void;
}

export function createTestSqliteFile(prefix: string): TestSqliteFile {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(directory, 'test.sqlite');

  return {
    filePath,
    cleanup() {
      fs.rmSync(directory, {recursive: true, force: true});
    },
  };
}
```

- [ ] **Step 3: 运行类型检查**

Run:

```bash
npm run lint
```

Expected: PASS。

- [ ] **Step 4: 提交依赖和测试工具**

Run:

```bash
git add package.json package-lock.json server/storage/sqlite/testSqlite.ts
git commit -m "chore: add sqlite dependency"
```

---

## Task 2: SQLite migration 和 client

**Files:**
- Create: `server/storage/sqlite/migrations.ts`
- Create: `server/storage/sqlite/sqliteClient.ts`
- Test: `server/storage/sqlite/sqliteClient.test.ts`

- [ ] **Step 1: 写 migration 失败测试**

Create `server/storage/sqlite/sqliteClient.test.ts`:

```ts
import {afterEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from './sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from './testSqlite';

let sqliteFile: TestSqliteFile | undefined;

afterEach(() => {
  sqliteFile?.cleanup();
  sqliteFile = undefined;
});

describe('openSqliteClient', () => {
  it('creates schema tables and seeds demo user', () => {
    sqliteFile = createTestSqliteFile('plantode-sqlite-client');
    const db = openSqliteClient(sqliteFile.filePath);

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all() as Array<{name: string}>;

    expect(tables.map((table) => table.name)).toEqual([
      'categories',
      'daily_reports',
      'schema_migrations',
      'task_execution_sessions',
      'tasks',
      'users',
      'weekly_reviews',
    ]);

    expect(db.prepare('select id, username, display_name from users where id = 1').get()).toEqual({
      id: 1,
      username: 'demo',
      display_name: 'Demo User',
    });

    expect(db.pragma('foreign_keys', {simple: true})).toBe(1);

    db.close();
  });

  it('runs migrations idempotently', () => {
    sqliteFile = createTestSqliteFile('plantode-sqlite-idempotent');

    const first = openSqliteClient(sqliteFile.filePath);
    first.close();

    const second = openSqliteClient(sqliteFile.filePath);
    const migrations = second.prepare('select version from schema_migrations order by version').all();

    expect(migrations).toEqual([{version: 1}]);

    second.close();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/sqliteClient.test.ts
```

Expected: FAIL，提示找不到 `./sqliteClient`。

- [ ] **Step 3: 实现 migrations**

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
    name: 'initial_schema',
    sql: `
      create table if not exists users (
        id integer primary key,
        username text not null,
        display_name text not null,
        created_at text not null
      );

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

      create index if not exists idx_tasks_user_date on tasks(user_id, planned_date);
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
      create index if not exists idx_sessions_user_started on task_execution_sessions(user_id, started_at);
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

      insert into users (id, username, display_name, created_at)
      values (1, 'demo', 'Demo User', datetime('now'))
      on conflict(id) do nothing;
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      executed_at text not null
    );
  `);

  const applied = new Set(
    (db.prepare('select version from schema_migrations').all() as Array<{version: number}>).map((row) => row.version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('insert into schema_migrations (version, name, executed_at) values (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
    });

    applyMigration();
  }
}
```

- [ ] **Step 4: 实现 SQLite client**

Create `server/storage/sqlite/sqliteClient.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import {runMigrations} from './migrations';

export function openSqliteClient(filePath: string): Database.Database {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {recursive: true});
  }

  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  return db;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
npm test -- server/storage/sqlite/sqliteClient.test.ts
```

Expected: 2 tests passed。

- [ ] **Step 6: 提交 migration 和 client**

Run:

```bash
git add server/storage/sqlite/migrations.ts server/storage/sqlite/sqliteClient.ts server/storage/sqlite/sqliteClient.test.ts
git commit -m "feat: add sqlite migration client"
```

---

## Task 3: SQLite row mappers

**Files:**
- Create: `server/storage/sqlite/repositories/rowMappers.ts`
- Test: `server/storage/sqlite/repositories/rowMappers.test.ts`

- [ ] **Step 1: 写 row mapper 测试**

Create `server/storage/sqlite/repositories/rowMappers.test.ts`:

```ts
import {describe, expect, it} from 'vitest';

import {
  mapCategoryRow,
  mapDailyReportRow,
  mapSessionRow,
  mapTaskRow,
  mapWeeklyReviewRow,
} from './rowMappers';

describe('sqlite row mappers', () => {
  it('maps snake_case rows into domain entities', () => {
    expect(mapCategoryRow({
      id: 1,
      user_id: 1,
      name: '工作',
      color: '#ef4444',
      sort_order: 10,
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    })).toEqual({
      id: 1,
      userId: 1,
      name: '工作',
      color: '#ef4444',
      sortOrder: 10,
      createdAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    });

    expect(mapTaskRow({
      id: 2,
      user_id: 1,
      category_id: 1,
      title: '写方案',
      planned_date: '2026-06-05',
      status: 'TODO',
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    }).categoryId).toBe(1);

    expect(mapSessionRow({
      id: 3,
      task_id: 2,
      user_id: 1,
      started_at: '2026-06-05T01:00:00.000Z',
      ended_at: null,
      duration_seconds: null,
      status: 'RUNNING',
      created_at: '2026-06-05T01:00:00.000Z',
      task_title: null,
    }).endedAt).toBeUndefined();

    expect(mapDailyReportRow({
      id: 4,
      user_id: 1,
      report_date: '2026-06-05',
      content: '日报',
      generator_type: 'RULE_BASED',
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    }).reportDate).toBe('2026-06-05');

    expect(mapWeeklyReviewRow({
      id: 5,
      user_id: 1,
      week_start_date: '2026-06-01',
      week_end_date: '2026-06-07',
      content: '周报',
      generator_type: 'RULE_BASED',
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    }).weekStartDate).toBe('2026-06-01');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/repositories/rowMappers.test.ts
```

Expected: FAIL，提示找不到 `./rowMappers`。

- [ ] **Step 3: 实现 row mappers**

Create `server/storage/sqlite/repositories/rowMappers.ts`:

```ts
import type {Category, DailyReport, Task, TaskExecutionSession, WeeklyReview} from '../../../../shared/domain/entities';
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
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  task_title: string | null;
}

export interface DailyReportRow {
  id: number;
  user_id: number;
  report_date: string;
  content: string;
  generator_type: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReviewRow {
  id: number;
  user_id: number;
  week_start_date: string;
  week_end_date: string;
  content: string;
  generator_type: string;
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
    status: row.status as TaskStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionRow(row: SessionRow): TaskExecutionSession {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status as SessionStatus,
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
    generatorType: row.generator_type as ReportGeneratorType,
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
    generatorType: row.generator_type as ReportGeneratorType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: 运行 mapper 测试**

Run:

```bash
npm test -- server/storage/sqlite/repositories/rowMappers.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交 row mappers**

Run:

```bash
git add server/storage/sqlite/repositories/rowMappers.ts server/storage/sqlite/repositories/rowMappers.test.ts
git commit -m "feat: add sqlite row mappers"
```

---

## Task 4: Category 和 Task SQLite repositories

**Files:**
- Create: `server/storage/sqlite/repositories/categorySqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`
- Create: `server/storage/sqlite/repositories/taskSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`

- [ ] **Step 1: 写 Category repository 失败测试**

Create `server/storage/sqlite/repositories/categorySqliteRepository.test.ts`:

```ts
import type Database from 'better-sqlite3';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from '../sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from '../testSqlite';
import {CategorySqliteRepository} from './categorySqliteRepository';

let sqliteFile: TestSqliteFile;
let db: Database.Database;
let repository: CategorySqliteRepository;

beforeEach(() => {
  sqliteFile = createTestSqliteFile('plantode-category-repository');
  db = openSqliteClient(sqliteFile.filePath);
  repository = new CategorySqliteRepository(db);
});

afterEach(() => {
  db.close();
  sqliteFile.cleanup();
});

describe('CategorySqliteRepository', () => {
  it('creates, lists, updates, finds by name, and removes categories', () => {
    const first = repository.create({userId: 1, name: ' 工作 ', color: '#ef4444', sortOrder: 20});
    const second = repository.create({userId: 1, name: '生活', color: '#22c55e', sortOrder: 10});

    expect(first).toMatchObject({id: 1, userId: 1, name: '工作', color: '#ef4444', sortOrder: 20});
    expect(second.id).toBe(2);
    expect(repository.existsByName(1, '工作')).toBe(true);
    expect(repository.existsByName(1, ' 工作 ')).toBe(true);
    expect(repository.existsByName(1, '不存在')).toBe(false);

    expect(repository.listByUser(1).map((category) => category.name)).toEqual(['生活', '工作']);
    expect(repository.getById(first.id, 1)?.name).toBe('工作');

    const updated = repository.update({id: first.id, userId: 1, name: '深度工作', color: '', sortOrder: 5});
    expect(updated).toMatchObject({name: '深度工作', color: '#64748b', sortOrder: 5});
    expect(repository.listByUser(1).map((category) => category.name)).toEqual(['深度工作', '生活']);

    expect(repository.remove(second.id, 1)).toBe(true);
    expect(repository.remove(999, 1)).toBe(false);
    expect(repository.listByUser(1).map((category) => category.name)).toEqual(['深度工作']);
  });
});
```

- [ ] **Step 2: 运行 Category 测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/repositories/categorySqliteRepository.test.ts
```

Expected: FAIL，提示找不到 `./categorySqliteRepository`。

- [ ] **Step 3: 实现 Category repository**

Create `server/storage/sqlite/repositories/categorySqliteRepository.ts` with methods matching `CategoryRepository`. Required behavior:

```ts
import type Database from 'better-sqlite3';

import type {CategoryRepository, CreateCategoryInput, UpdateCategoryInput} from '../../../modules/categories/repository';
import type {Category} from '../../../../shared/domain/entities';
import {mapCategoryRow, type CategoryRow} from './rowMappers';

export class CategorySqliteRepository implements CategoryRepository {
  constructor(private readonly db: Database.Database) {}

  listByUser(userId: number): Category[] {
    return (this.db
      .prepare('select * from categories where user_id = ? order by sort_order asc, name asc')
      .all(userId) as CategoryRow[]).map(mapCategoryRow);
  }

  getById(id: number, userId: number): Category | undefined {
    const row = this.db.prepare('select * from categories where id = ? and user_id = ?').get(id, userId) as CategoryRow | undefined;
    return row ? mapCategoryRow(row) : undefined;
  }

  existsByName(userId: number, name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    const row = this.db
      .prepare('select id from categories where user_id = ? and lower(trim(name)) = ? limit 1')
      .get(userId, normalizedName);
    return Boolean(row);
  }

  create(input: CreateCategoryInput): Category {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('insert into categories (user_id, name, color, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?)')
      .run(input.userId, input.name.trim(), input.color || '#64748b', input.sortOrder, now, now);
    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  update(input: UpdateCategoryInput): Category | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('update categories set name = ?, color = ?, sort_order = ?, updated_at = ? where id = ? and user_id = ?')
      .run(input.name.trim(), input.color || '#64748b', input.sortOrder, now, input.id, input.userId);
    if (result.changes === 0) return undefined;
    return this.getById(input.id, input.userId);
  }

  remove(id: number, userId: number): boolean {
    return this.db.prepare('delete from categories where id = ? and user_id = ?').run(id, userId).changes > 0;
  }
}
```

- [ ] **Step 4: 写 Task repository 失败测试**

Create `server/storage/sqlite/repositories/taskSqliteRepository.test.ts`:

```ts
import type Database from 'better-sqlite3';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from '../sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from '../testSqlite';
import {CategorySqliteRepository} from './categorySqliteRepository';
import {TaskSqliteRepository} from './taskSqliteRepository';

let sqliteFile: TestSqliteFile;
let db: Database.Database;
let categories: CategorySqliteRepository;
let tasks: TaskSqliteRepository;

beforeEach(() => {
  sqliteFile = createTestSqliteFile('plantode-task-repository');
  db = openSqliteClient(sqliteFile.filePath);
  categories = new CategorySqliteRepository(db);
  tasks = new TaskSqliteRepository(db);
});

afterEach(() => {
  db.close();
  sqliteFile.cleanup();
});

describe('TaskSqliteRepository', () => {
  it('creates, filters, reads, and updates task status', () => {
    const work = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const life = categories.create({userId: 1, name: '生活', color: '#22c55e', sortOrder: 2});

    const first = tasks.create({userId: 1, categoryId: work.id, title: ' 写方案 ', plannedDate: '2026-06-05'});
    const second = tasks.create({userId: 1, categoryId: life.id, title: '运动', plannedDate: '2026-06-06'});

    expect(first).toMatchObject({id: 1, title: '写方案', status: 'TODO'});
    expect(second.id).toBe(2);
    expect(tasks.getById(first.id, 1)?.title).toBe('写方案');

    expect(tasks.listByFilters({userId: 1, plannedDate: '2026-06-05'}).map((task) => task.title)).toEqual(['写方案']);
    expect(tasks.listByFilters({userId: 1, categoryId: life.id}).map((task) => task.title)).toEqual(['运动']);
    expect(tasks.listByFilters({userId: 1, status: 'TODO'}).map((task) => task.title)).toEqual(['写方案', '运动']);

    expect(tasks.updateStatus(first.id, 1, 'DONE')).toMatchObject({status: 'DONE'});
    expect(tasks.updateStatus(999, 1, 'DONE')).toBeUndefined();
    expect(tasks.listByFilters({userId: 1, status: 'DONE'}).map((task) => task.title)).toEqual(['写方案']);
  });
});
```

- [ ] **Step 5: 运行 Task 测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: FAIL，提示找不到 `./taskSqliteRepository`。

- [ ] **Step 6: 实现 Task repository**

Create `server/storage/sqlite/repositories/taskSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {CreateTaskInput, TaskFilters, TaskRepository} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {mapTaskRow, type TaskRow} from './rowMappers';

export class TaskSqliteRepository implements TaskRepository {
  constructor(private readonly db: Database.Database) {}

  listByFilters(filters: TaskFilters): Task[] {
    const clauses = ['user_id = ?'];
    const values: Array<string | number> = [filters.userId];
    if (filters.plannedDate) {
      clauses.push('planned_date = ?');
      values.push(filters.plannedDate);
    }
    if (filters.status) {
      clauses.push('status = ?');
      values.push(filters.status);
    }
    if (filters.categoryId) {
      clauses.push('category_id = ?');
      values.push(filters.categoryId);
    }

    return (this.db
      .prepare(`select * from tasks where ${clauses.join(' and ')} order by created_at asc`)
      .all(...values) as TaskRow[]).map(mapTaskRow);
  }

  getById(taskId: number, userId: number): Task | undefined {
    const row = this.db.prepare('select * from tasks where id = ? and user_id = ?').get(taskId, userId) as TaskRow | undefined;
    return row ? mapTaskRow(row) : undefined;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('insert into tasks (user_id, category_id, title, planned_date, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(input.userId, input.categoryId, input.title.trim(), input.plannedDate, 'TODO', now, now);
    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('update tasks set status = ?, updated_at = ? where id = ? and user_id = ?')
      .run(status, now, taskId, userId);
    if (result.changes === 0) return undefined;
    return this.getById(taskId, userId);
  }
}
```

- [ ] **Step 7: 运行 Category 和 Task 测试**

Run:

```bash
npm test -- server/storage/sqlite/repositories/categorySqliteRepository.test.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交 Category 和 Task repositories**

Run:

```bash
git add server/storage/sqlite/repositories/categorySqliteRepository.ts server/storage/sqlite/repositories/categorySqliteRepository.test.ts server/storage/sqlite/repositories/taskSqliteRepository.ts server/storage/sqlite/repositories/taskSqliteRepository.test.ts
git commit -m "feat: add sqlite category and task repositories"
```

---

## Task 5: Focus session 和 Report SQLite repositories

**Files:**
- Create: `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`
- Create: `server/storage/sqlite/repositories/reportSqliteRepository.ts`
- Test: `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`

- [ ] **Step 1: 写 Focus session repository 失败测试**

Create `server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts`:

```ts
import type Database from 'better-sqlite3';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from '../sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from '../testSqlite';
import {CategorySqliteRepository} from './categorySqliteRepository';
import {FocusSessionSqliteRepository} from './focusSessionSqliteRepository';
import {TaskSqliteRepository} from './taskSqliteRepository';

let sqliteFile: TestSqliteFile;
let db: Database.Database;
let categories: CategorySqliteRepository;
let tasks: TaskSqliteRepository;
let sessions: FocusSessionSqliteRepository;

beforeEach(() => {
  sqliteFile = createTestSqliteFile('plantode-focus-repository');
  db = openSqliteClient(sqliteFile.filePath);
  categories = new CategorySqliteRepository(db);
  tasks = new TaskSqliteRepository(db);
  sessions = new FocusSessionSqliteRepository(db);
});

afterEach(() => {
  db.close();
  sqliteFile.cleanup();
});

describe('FocusSessionSqliteRepository', () => {
  it('creates running sessions, lists them, and stops them', () => {
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const task = tasks.create({userId: 1, categoryId: category.id, title: '写方案', plannedDate: '2026-06-05'});

    const running = sessions.createRunning({
      taskId: task.id,
      userId: 1,
      startedAt: '2026-06-05T01:00:00.000Z',
    });

    expect(running).toMatchObject({id: 1, taskId: task.id, userId: 1, status: 'RUNNING'});
    expect(sessions.getRunningByUser(1)?.id).toBe(running.id);
    expect(sessions.listByTask(task.id, 1).map((session) => session.id)).toEqual([running.id]);
    expect(sessions.listByDateRange(1, '2026-06-05T00:00:00.000Z', '2026-06-05T23:59:59.999Z')).toHaveLength(1);

    const stopped = sessions.stop({
      sessionId: running.id,
      userId: 1,
      endedAt: '2026-06-05T01:30:00.000Z',
    });

    expect(stopped).toMatchObject({status: 'COMPLETED', durationSeconds: 1800});
    expect(sessions.getRunningByUser(1)).toBeUndefined();
    expect(sessions.stop({sessionId: running.id, userId: 1})).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行 Focus 测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts
```

Expected: FAIL，提示找不到 `./focusSessionSqliteRepository`。

- [ ] **Step 3: 实现 Focus session repository**

Create `server/storage/sqlite/repositories/focusSessionSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {CreateRunningSessionInput, FocusSessionRepository, StopSessionInput} from '../../../modules/focus/repository';
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {mapSessionRow, type SessionRow} from './rowMappers';

function calculateDurationSeconds(startedAt: string, endedAt: string): number {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
}

export class FocusSessionSqliteRepository implements FocusSessionRepository {
  constructor(private readonly db: Database.Database) {}

  getRunningByUser(userId: number): TaskExecutionSession | undefined {
    const row = this.db
      .prepare("select * from task_execution_sessions where user_id = ? and status = 'RUNNING' limit 1")
      .get(userId) as SessionRow | undefined;
    return row ? mapSessionRow(row) : undefined;
  }

  listByTask(taskId: number, userId: number): TaskExecutionSession[] {
    return (this.db
      .prepare('select * from task_execution_sessions where task_id = ? and user_id = ? order by started_at desc')
      .all(taskId, userId) as SessionRow[]).map(mapSessionRow);
  }

  listByDateRange(userId: number, startAt: string, endAt: string): TaskExecutionSession[] {
    return (this.db
      .prepare('select * from task_execution_sessions where user_id = ? and started_at >= ? and started_at <= ? order by started_at asc')
      .all(userId, startAt, endAt) as SessionRow[]).map(mapSessionRow);
  }

  createRunning(input: CreateRunningSessionInput): TaskExecutionSession {
    const startedAt = input.startedAt ?? new Date().toISOString();
    const result = this.db
      .prepare('insert into task_execution_sessions (task_id, user_id, started_at, status, created_at) values (?, ?, ?, ?, ?)')
      .run(input.taskId, input.userId, startedAt, 'RUNNING', startedAt);
    const row = this.db.prepare('select * from task_execution_sessions where id = ?').get(Number(result.lastInsertRowid)) as SessionRow;
    return mapSessionRow(row);
  }

  stop(input: StopSessionInput): TaskExecutionSession | undefined {
    const row = this.db
      .prepare("select * from task_execution_sessions where id = ? and user_id = ? and status = 'RUNNING'")
      .get(input.sessionId, input.userId) as SessionRow | undefined;
    if (!row) return undefined;

    const endedAt = input.endedAt ?? new Date().toISOString();
    const durationSeconds = calculateDurationSeconds(row.started_at, endedAt);
    this.db
      .prepare("update task_execution_sessions set ended_at = ?, duration_seconds = ?, status = 'COMPLETED' where id = ? and user_id = ?")
      .run(endedAt, durationSeconds, input.sessionId, input.userId);

    const updated = this.db.prepare('select * from task_execution_sessions where id = ?').get(input.sessionId) as SessionRow;
    return mapSessionRow(updated);
  }
}
```

- [ ] **Step 4: 写 Report repository 失败测试**

Create `server/storage/sqlite/repositories/reportSqliteRepository.test.ts`:

```ts
import type Database from 'better-sqlite3';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from '../sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from '../testSqlite';
import {ReportSqliteRepository} from './reportSqliteRepository';

let sqliteFile: TestSqliteFile;
let db: Database.Database;
let reports: ReportSqliteRepository;

beforeEach(() => {
  sqliteFile = createTestSqliteFile('plantode-report-repository');
  db = openSqliteClient(sqliteFile.filePath);
  reports = new ReportSqliteRepository(db);
});

afterEach(() => {
  db.close();
  sqliteFile.cleanup();
});

describe('ReportSqliteRepository', () => {
  it('saves and updates daily reports', () => {
    const created = reports.saveDaily(1, '2026-06-05', 'first daily');
    const updated = reports.saveDaily(1, '2026-06-05', 'second daily');

    expect(created.id).toBe(updated.id);
    expect(updated.content).toBe('second daily');
    expect(reports.getDaily(1, '2026-06-05')?.content).toBe('second daily');
  });

  it('saves and updates weekly reviews', () => {
    const created = reports.saveWeekly(1, '2026-06-01', '2026-06-07', 'first weekly');
    const updated = reports.saveWeekly(1, '2026-06-01', '2026-06-08', 'second weekly');

    expect(created.id).toBe(updated.id);
    expect(updated.weekEndDate).toBe('2026-06-08');
    expect(reports.getWeekly(1, '2026-06-01')?.content).toBe('second weekly');
  });
});
```

- [ ] **Step 5: 运行 Report 测试确认失败**

Run:

```bash
npm test -- server/storage/sqlite/repositories/reportSqliteRepository.test.ts
```

Expected: FAIL，提示找不到 `./reportSqliteRepository`。

- [ ] **Step 6: 实现 Report repository**

Create `server/storage/sqlite/repositories/reportSqliteRepository.ts`:

```ts
import type Database from 'better-sqlite3';

import type {ReportRepository} from '../../../modules/reports/repository';
import type {DailyReport, WeeklyReview} from '../../../../shared/domain/entities';
import {mapDailyReportRow, mapWeeklyReviewRow, type DailyReportRow, type WeeklyReviewRow} from './rowMappers';

export class ReportSqliteRepository implements ReportRepository {
  constructor(private readonly db: Database.Database) {}

  getDaily(userId: number, reportDate: string): DailyReport | undefined {
    const row = this.db.prepare('select * from daily_reports where user_id = ? and report_date = ?').get(userId, reportDate) as DailyReportRow | undefined;
    return row ? mapDailyReportRow(row) : undefined;
  }

  saveDaily(userId: number, reportDate: string, content: string): DailyReport {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        insert into daily_reports (user_id, report_date, content, generator_type, created_at, updated_at)
        values (?, ?, ?, 'RULE_BASED', ?, ?)
        on conflict(user_id, report_date) do update set content = excluded.content, updated_at = excluded.updated_at
      `)
      .run(userId, reportDate, content, now, now);
    return this.getDaily(userId, reportDate)!;
  }

  getWeekly(userId: number, weekStartDate: string): WeeklyReview | undefined {
    const row = this.db.prepare('select * from weekly_reviews where user_id = ? and week_start_date = ?').get(userId, weekStartDate) as WeeklyReviewRow | undefined;
    return row ? mapWeeklyReviewRow(row) : undefined;
  }

  saveWeekly(userId: number, weekStartDate: string, weekEndDate: string, content: string): WeeklyReview {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        insert into weekly_reviews (user_id, week_start_date, week_end_date, content, generator_type, created_at, updated_at)
        values (?, ?, ?, ?, 'RULE_BASED', ?, ?)
        on conflict(user_id, week_start_date) do update set
          week_end_date = excluded.week_end_date,
          content = excluded.content,
          updated_at = excluded.updated_at
      `)
      .run(userId, weekStartDate, weekEndDate, content, now, now);
    return this.getWeekly(userId, weekStartDate)!;
  }
}
```

- [ ] **Step 7: 运行 Focus 和 Report 测试**

Run:

```bash
npm test -- server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts server/storage/sqlite/repositories/reportSqliteRepository.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交 Focus 和 Report repositories**

Run:

```bash
git add server/storage/sqlite/repositories/focusSessionSqliteRepository.ts server/storage/sqlite/repositories/focusSessionSqliteRepository.test.ts server/storage/sqlite/repositories/reportSqliteRepository.ts server/storage/sqlite/repositories/reportSqliteRepository.test.ts
git commit -m "feat: add sqlite focus and report repositories"
```

---

## Task 6: Repository factory 和后端装配

**Files:**
- Create: `server/storage/createRepositories.ts`
- Test: `server/storage/createRepositories.test.ts`
- Modify: `server/app/registerRoutes.ts`
- Modify: `.env.example`

- [ ] **Step 1: 写 repository factory 失败测试**

Create `server/storage/createRepositories.test.ts`:

```ts
import {afterEach, describe, expect, it, vi} from 'vitest';

import {createRepositoriesFromEnv} from './createRepositories';
import {createTestSqliteFile, type TestSqliteFile} from './sqlite/testSqlite';

let sqliteFile: TestSqliteFile | undefined;
let jsonFile: TestSqliteFile | undefined;

afterEach(() => {
  sqliteFile?.cleanup();
  jsonFile?.cleanup();
  sqliteFile = undefined;
  jsonFile = undefined;
  vi.unstubAllEnvs();
});

describe('createRepositoriesFromEnv', () => {
  it('defaults to json repositories', () => {
    jsonFile = createTestSqliteFile('plantode-json-factory');
    vi.stubEnv('JSON_DB_PATH', jsonFile.filePath);

    const repositories = createRepositoriesFromEnv();

    expect(repositories.categories.constructor.name).toBe('CategoryJsonRepository');
    expect(repositories.tasks.constructor.name).toBe('TaskJsonRepository');
    expect(repositories.focusSessions.constructor.name).toBe('FocusSessionJsonRepository');
    expect(repositories.reports.constructor.name).toBe('ReportJsonRepository');
  });

  it('creates sqlite repositories when STORAGE_DRIVER is sqlite', () => {
    sqliteFile = createTestSqliteFile('plantode-repository-factory');
    vi.stubEnv('STORAGE_DRIVER', 'sqlite');
    vi.stubEnv('SQLITE_DB_PATH', sqliteFile.filePath);

    const repositories = createRepositoriesFromEnv();

    expect(repositories.categories.constructor.name).toBe('CategorySqliteRepository');
    expect(repositories.tasks.constructor.name).toBe('TaskSqliteRepository');
    expect(repositories.focusSessions.constructor.name).toBe('FocusSessionSqliteRepository');
    expect(repositories.reports.constructor.name).toBe('ReportSqliteRepository');
  });

  it('rejects unknown storage drivers', () => {
    vi.stubEnv('STORAGE_DRIVER', 'postgres');

    expect(() => createRepositoriesFromEnv()).toThrow('Unsupported STORAGE_DRIVER "postgres"');
  });
});
```

- [ ] **Step 2: 运行 factory 测试确认失败**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
```

Expected: FAIL，提示找不到 `./createRepositories`。

- [ ] **Step 3: 实现 repository factory**

Create `server/storage/createRepositories.ts`:

```ts
import path from 'node:path';

import type {CategoryRepository} from '../modules/categories/repository';
import type {FocusSessionRepository} from '../modules/focus/repository';
import type {ReportRepository} from '../modules/reports/repository';
import type {TaskRepository} from '../modules/tasks/repository';
import {CategoryJsonRepository} from './json/repositories/categoryJsonRepository';
import {FocusSessionJsonRepository} from './json/repositories/focusSessionJsonRepository';
import {JsonFileStore} from './json/fileStore';
import {ReportJsonRepository} from './json/repositories/reportJsonRepository';
import {TaskJsonRepository} from './json/repositories/taskJsonRepository';
import {openSqliteClient} from './sqlite/sqliteClient';
import {CategorySqliteRepository} from './sqlite/repositories/categorySqliteRepository';
import {FocusSessionSqliteRepository} from './sqlite/repositories/focusSessionSqliteRepository';
import {ReportSqliteRepository} from './sqlite/repositories/reportSqliteRepository';
import {TaskSqliteRepository} from './sqlite/repositories/taskSqliteRepository';

export interface AppRepositories {
  categories: CategoryRepository;
  tasks: TaskRepository;
  focusSessions: FocusSessionRepository;
  reports: ReportRepository;
}

export function createRepositoriesFromEnv(env: NodeJS.ProcessEnv = process.env): AppRepositories {
  const driver = env.STORAGE_DRIVER ?? 'json';

  if (driver === 'json') {
    const store = new JsonFileStore(path.resolve(env.JSON_DB_PATH ?? 'data/db.json'));
    return {
      categories: new CategoryJsonRepository(store),
      tasks: new TaskJsonRepository(store),
      focusSessions: new FocusSessionJsonRepository(store),
      reports: new ReportJsonRepository(store),
    };
  }

  if (driver === 'sqlite') {
    const db = openSqliteClient(path.resolve(env.SQLITE_DB_PATH ?? 'data/plantode.sqlite'));
    return {
      categories: new CategorySqliteRepository(db),
      tasks: new TaskSqliteRepository(db),
      focusSessions: new FocusSessionSqliteRepository(db),
      reports: new ReportSqliteRepository(db),
    };
  }

  throw new Error(`Unsupported STORAGE_DRIVER "${driver}"`);
}
```

- [ ] **Step 4: 修改 registerRoutes 装配**

Modify `server/app/registerRoutes.ts` to remove direct JSON construction and use factory:

```ts
import {Router} from 'express';

import {buildCategoryRoutes} from '../modules/categories/routes';
import {CategoriesService} from '../modules/categories/service';
import {buildFocusRoutes} from '../modules/focus/routes';
import {FocusService} from '../modules/focus/service';
import {buildReportRoutes} from '../modules/reports/routes';
import {ReportsService} from '../modules/reports/service';
import {buildTaskRoutes} from '../modules/tasks/routes';
import {TasksService} from '../modules/tasks/service';
import {createRepositoriesFromEnv} from '../storage/createRepositories';

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

- [ ] **Step 5: 更新环境变量示例**

Modify `.env.example`:

```txt
STORAGE_DRIVER=sqlite
SQLITE_DB_PATH=data/plantode.sqlite
JSON_DB_PATH=data/db.json
```

- [ ] **Step 6: 运行 factory 测试和类型检查**

Run:

```bash
npm test -- server/storage/createRepositories.test.ts
npm run lint
```

Expected: PASS。

- [ ] **Step 7: 提交装配层**

Run:

```bash
git add server/storage/createRepositories.ts server/storage/createRepositories.test.ts server/app/registerRoutes.ts .env.example
git commit -m "feat: switch storage driver by environment"
```

---

## Task 7: 文档和全量验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 存储说明**

Modify `README.md` to include:

````md
## 存储驱动

默认使用 SQLite 文件存储：

```bash
STORAGE_DRIVER=sqlite
SQLITE_DB_PATH=data/plantode.sqlite
```

也可以切换到 JSON：

```bash
STORAGE_DRIVER=json
JSON_DB_PATH=data/db.json
```

SQLite 使用 `better-sqlite3`，启动时会自动执行 schema migration。JSON 到 SQLite 的历史数据迁移可通过 `scripts/importJsonToSqlite.ts` 独立执行。
```
````

- [ ] **Step 2: 运行全量测试**

Run:

```bash
npm test
```

Expected: 现有测试和新增 SQLite 测试全部 PASS。

- [ ] **Step 3: 运行类型检查**

Run:

```bash
npm run lint
```

Expected: PASS。

- [ ] **Step 4: 运行构建**

Run:

```bash
npm run build
```

Expected: PASS。

- [ ] **Step 5: 手动验证 SQLite driver 基础 API**

Run server:

```bash
STORAGE_DRIVER=sqlite SQLITE_DB_PATH=data/test-plantode.sqlite npm run dev
```

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

Stop the dev server after verification.

- [ ] **Step 6: Remove manual verification database**

Run:

```bash
rm -f data/test-plantode.sqlite
```

Expected: no generated SQLite test database remains in the worktree.

- [ ] **Step 7: 提交文档和验证收尾**

Run:

```bash
git add README.md
git commit -m "docs: document storage drivers"
```

---

## Final Verification Checklist

Before declaring implementation complete, run:

```bash
npm run lint
npm test
npm run build
```

Expected:

- TypeScript has 0 errors.
- Vitest reports all test files passed.
- Vite production build exits 0.

Then confirm:

```bash
git status --short
```

Expected:

```txt

```

No generated SQLite database files should be tracked or left untracked.
