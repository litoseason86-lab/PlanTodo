import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {openSqliteClient} from '../server/storage/sqlite/sqliteClient';

interface JsonUser {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

interface JsonCategory {
  id: number;
  userId: number;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface JsonTask {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate?: string | null;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonTaskExecutionSession {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: string;
  createdAt: string;
  taskTitle?: string;
  pausedAt?: string;
  accumulatedPauseSeconds?: number;
}

interface JsonDailyReport {
  id: number;
  userId: number;
  reportDate: string;
  content: string;
  generatorType: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonWeeklyReview {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  content: string;
  generatorType: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonDatabase {
  users?: JsonUser[];
  categories?: JsonCategory[];
  tasks?: JsonTask[];
  taskExecutionSessions?: JsonTaskExecutionSession[];
  dailyReports?: JsonDailyReport[];
  weeklyReviews?: JsonWeeklyReview[];
}

export interface ImportJsonToSqliteOptions {
  jsonPath: string;
  sqlitePath: string;
  force?: boolean;
}

export interface ImportJsonToSqliteResult {
  users: number;
  categories: number;
  tasks: number;
  taskExecutionSessions: number;
  dailyReports: number;
  weeklyReviews: number;
}

const BUSINESS_TABLES = [
  'weekly_reviews',
  'daily_reports',
  'task_execution_sessions',
  'tasks',
  'categories',
] as const;

function readJsonDatabase(jsonPath: string): JsonDatabase {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as JsonDatabase;
}

function countRows(db: ReturnType<typeof openSqliteClient>, table: string): number {
  return (db.prepare(`select count(*) as count from ${table}`).get() as {count: number}).count;
}

function hasBusinessData(db: ReturnType<typeof openSqliteClient>): boolean {
  return BUSINESS_TABLES.some((table) => countRows(db, table) > 0);
}

function clearBusinessData(db: ReturnType<typeof openSqliteClient>) {
  for (const table of BUSINESS_TABLES) {
    db.prepare(`delete from ${table}`).run();
  }
}

export function importJsonToSqlite({jsonPath, sqlitePath, force = false}: ImportJsonToSqliteOptions): ImportJsonToSqliteResult {
  const json = readJsonDatabase(jsonPath);
  const db = openSqliteClient(sqlitePath);

  try {
    if (hasBusinessData(db)) {
      if (!force) {
        throw new Error('SQLite database already contains business data. Re-run with force to replace it.');
      }
      clearBusinessData(db);
    }

    const importTransaction = db.transaction(() => {
      for (const user of json.users ?? []) {
        db.prepare(
          `insert into users (id, username, display_name, created_at)
           values (?, ?, ?, ?)
           on conflict(id) do update set
             username = excluded.username,
             display_name = excluded.display_name,
             created_at = excluded.created_at`,
        ).run(user.id, user.username, user.displayName, user.createdAt);
      }

      for (const category of json.categories ?? []) {
        db.prepare(
          `insert into categories (id, user_id, name, color, sort_order, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          category.id,
          category.userId,
          category.name,
          category.color,
          category.sortOrder,
          category.createdAt,
          category.updatedAt,
        );
      }

      for (const task of json.tasks ?? []) {
        const plannedDate = task.plannedDate?.trim() || null;
        const allDay = plannedDate ? task.allDay !== false : true;
        const plannedEndDate = plannedDate && allDay ? task.plannedEndDate ?? null : null;
        const startAt = plannedDate && !allDay ? task.startAt ?? null : null;
        const endAt = plannedDate && !allDay ? task.endAt ?? null : null;
        db.prepare(
          `insert into tasks (
             id, user_id, category_id, title, planned_date, planned_end_date, start_at, end_at, all_day, status, created_at, updated_at
           )
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          task.id,
          task.userId,
          task.categoryId,
          task.title,
          plannedDate,
          plannedEndDate,
          startAt,
          endAt,
          allDay ? 1 : 0,
          task.status,
          task.createdAt,
          task.updatedAt,
        );
      }

      for (const session of json.taskExecutionSessions ?? []) {
        db.prepare(
          `insert into task_execution_sessions (
             id, task_id, user_id, started_at, ended_at, duration_seconds, status, created_at,
             task_title, paused_at, accumulated_pause_seconds
           )
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          session.id,
          session.taskId,
          session.userId,
          session.startedAt,
          session.endedAt ?? null,
          session.durationSeconds ?? null,
          session.status,
          session.createdAt,
          session.taskTitle ?? null,
          session.pausedAt ?? null,
          session.accumulatedPauseSeconds ?? 0,
        );
      }

      for (const report of json.dailyReports ?? []) {
        db.prepare(
          `insert into daily_reports (id, user_id, report_date, content, generator_type, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          report.id,
          report.userId,
          report.reportDate,
          report.content,
          report.generatorType,
          report.createdAt,
          report.updatedAt,
        );
      }

      for (const review of json.weeklyReviews ?? []) {
        db.prepare(
          `insert into weekly_reviews (id, user_id, week_start_date, week_end_date, content, generator_type, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          review.id,
          review.userId,
          review.weekStartDate,
          review.weekEndDate,
          review.content,
          review.generatorType,
          review.createdAt,
          review.updatedAt,
        );
      }
    });

    importTransaction();

    return {
      users: countRows(db, 'users'),
      categories: countRows(db, 'categories'),
      tasks: countRows(db, 'tasks'),
      taskExecutionSessions: countRows(db, 'task_execution_sessions'),
      dailyReports: countRows(db, 'daily_reports'),
      weeklyReviews: countRows(db, 'weekly_reviews'),
    };
  } finally {
    db.close();
  }
}

function parseCliArgs(argv: string[]) {
  const options = {
    jsonPath: 'data/db.json',
    sqlitePath: 'data/plantodo.sqlite',
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--json') {
      options.jsonPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--sqlite') {
      options.sqlitePath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    jsonPath: path.resolve(options.jsonPath),
    sqlitePath: path.resolve(options.sqlitePath),
    force: options.force,
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const result = importJsonToSqlite(parseCliArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
