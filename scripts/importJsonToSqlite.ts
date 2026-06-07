import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {TaskPriority} from '../shared/domain/status';
import {normalizeTagName} from '../server/modules/tags/schemas';
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
  priority?: TaskPriority | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonTag {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonTaskTag {
  taskId: number;
  tagId: number;
  userId: number;
  createdAt: string;
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
  tags?: JsonTag[];
  tasks?: JsonTask[];
  taskTags?: JsonTaskTag[];
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
  tags: number;
  tasks: number;
  taskTags: number;
  taskExecutionSessions: number;
  dailyReports: number;
  weeklyReviews: number;
}

const BUSINESS_TABLES = [
  'task_tags',
  'weekly_reviews',
  'daily_reports',
  'task_execution_sessions',
  'tasks',
  'tags',
  'categories',
] as const;

type SqliteClient = ReturnType<typeof openSqliteClient>;

function readJsonDatabase(jsonPath: string): JsonDatabase {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as JsonDatabase;
}

function countRows(db: SqliteClient, table: string): number {
  return (db.prepare(`select count(*) as count from ${table}`).get() as {count: number}).count;
}

function hasBusinessData(db: SqliteClient): boolean {
  return BUSINESS_TABLES.some((table) => countRows(db, table) > 0);
}

function clearBusinessData(db: SqliteClient) {
  for (const table of BUSINESS_TABLES) {
    db.prepare(`delete from ${table}`).run();
  }
}

function insertUsers(db: SqliteClient, users: JsonUser[]) {
  for (const user of users) {
    db.prepare(
      `insert into users (id, username, display_name, created_at)
       values (?, ?, ?, ?)
       on conflict(id) do update set
         username = excluded.username,
         display_name = excluded.display_name,
         created_at = excluded.created_at`,
    ).run(user.id, user.username, user.displayName, user.createdAt);
  }
}

function insertCategories(db: SqliteClient, categories: JsonCategory[]) {
  for (const category of categories) {
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
}

function insertTags(db: SqliteClient, tags: JsonTag[]) {
  for (const tag of tags) {
    db.prepare(
      `insert into tags (id, user_id, name, normalized_name, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    ).run(tag.id, tag.userId, tag.name, normalizeTagName(tag.name).normalizedName, tag.createdAt, tag.updatedAt);
  }
}

function insertTasks(db: SqliteClient, tasks: JsonTask[]) {
  for (const task of tasks) {
    const plannedDate = task.plannedDate?.trim() || null;
    const allDay = plannedDate ? task.allDay !== false : true;
    const plannedEndDate = plannedDate && allDay ? task.plannedEndDate ?? null : null;
    const startAt = plannedDate && !allDay ? task.startAt ?? null : null;
    const endAt = plannedDate && !allDay ? task.endAt ?? null : null;
    db.prepare(
      `insert into tasks (
         id, user_id, category_id, title, planned_date, planned_end_date, start_at, end_at, all_day, priority, status, created_at, updated_at
       )
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      task.priority ?? null,
      task.status,
      task.createdAt,
      task.updatedAt,
    );
  }
}

function insertTaskTagsAfterValidation(db: SqliteClient, taskTags: JsonTaskTag[], tasks: JsonTask[], tags: JsonTag[]) {
  const taskOwners = new Map(tasks.map((task) => [task.id, task.userId]));
  const tagOwners = new Map(tags.map((tag) => [tag.id, tag.userId]));

  for (const taskTag of taskTags) {
    const task = taskOwners.get(taskTag.taskId);
    const tag = tagOwners.get(taskTag.tagId);
    if (task !== taskTag.userId || tag !== taskTag.userId) {
      throw new Error('Invalid taskTags association');
    }
    db.prepare(
      `insert into task_tags (task_id, tag_id, user_id, created_at)
       values (?, ?, ?, ?)`,
    ).run(taskTag.taskId, taskTag.tagId, taskTag.userId, taskTag.createdAt);
  }
}

function insertTaskExecutionSessions(db: SqliteClient, sessions: JsonTaskExecutionSession[]) {
  for (const session of sessions) {
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
}

function insertDailyReports(db: SqliteClient, reports: JsonDailyReport[]) {
  for (const report of reports) {
    db.prepare(
      `insert into daily_reports (id, user_id, report_date, content, generator_type, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    ).run(report.id, report.userId, report.reportDate, report.content, report.generatorType, report.createdAt, report.updatedAt);
  }
}

function insertWeeklyReviews(db: SqliteClient, reviews: JsonWeeklyReview[]) {
  for (const review of reviews) {
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
}

export function importJsonToSqlite({jsonPath, sqlitePath, force = false}: ImportJsonToSqliteOptions): ImportJsonToSqliteResult {
  const json = readJsonDatabase(jsonPath);
  const db = openSqliteClient(sqlitePath);

  try {
    const importTransaction = db.transaction(() => {
      if (hasBusinessData(db)) {
        if (!force) {
          throw new Error('SQLite database already contains business data. Re-run with force to replace it.');
        }
        clearBusinessData(db);
      }

      const tags = json.tags ?? [];
      const tasks = json.tasks ?? [];
      insertUsers(db, json.users ?? []);
      insertCategories(db, json.categories ?? []);
      insertTags(db, tags);
      insertTasks(db, tasks);
      insertTaskTagsAfterValidation(db, json.taskTags ?? [], tasks, tags);
      insertTaskExecutionSessions(db, json.taskExecutionSessions ?? []);
      insertDailyReports(db, json.dailyReports ?? []);
      insertWeeklyReviews(db, json.weeklyReviews ?? []);
    });

    importTransaction();

    return {
      users: countRows(db, 'users'),
      categories: countRows(db, 'categories'),
      tags: countRows(db, 'tags'),
      tasks: countRows(db, 'tasks'),
      taskTags: countRows(db, 'task_tags'),
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
