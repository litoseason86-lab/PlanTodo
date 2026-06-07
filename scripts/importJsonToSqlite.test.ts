import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from '../server/storage/sqlite/sqliteClient';
import {importJsonToSqlite} from './importJsonToSqlite';

interface TestFiles {
  directory: string;
  jsonPath: string;
  sqlitePath: string;
}

let files: TestFiles | undefined;

afterEach(() => {
  if (files) {
    fs.rmSync(files.directory, {recursive: true, force: true});
    files = undefined;
  }
});

function createTestFiles(): TestFiles {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plantodo-json-import-'));
  files = {
    directory,
    jsonPath: path.join(directory, 'db.json'),
    sqlitePath: path.join(directory, 'plantodo.sqlite'),
  };
  return files;
}

function writeJsonFixture(jsonPath: string) {
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      users: [
        {
          id: 1,
          username: 'demo',
          displayName: 'Demo User',
          createdAt: '2026-06-04T18:31:33.856Z',
        },
      ],
      categories: [
        {
          id: 7,
          userId: 1,
          name: '学习',
          color: '#3b82f6',
          sortOrder: 20,
          createdAt: '2026-06-04T18:31:33.856Z',
          updatedAt: '2026-06-04T18:31:33.856Z',
        },
      ],
      tasks: [
        {
          id: 11,
          userId: 1,
          categoryId: 7,
          title: '复习数学',
          plannedDate: '2026-06-05',
          status: 'DONE',
          createdAt: '2026-06-05T01:00:00.000Z',
          updatedAt: '2026-06-05T02:00:00.000Z',
        },
      ],
      taskExecutionSessions: [
        {
          id: 13,
          taskId: 11,
          userId: 1,
          startedAt: '2026-06-05T01:00:00.000Z',
          endedAt: '2026-06-05T01:30:00.000Z',
          durationSeconds: 1800,
          status: 'COMPLETED',
          createdAt: '2026-06-05T01:00:00.000Z',
          taskTitle: '复习数学',
          pausedAt: undefined,
          accumulatedPauseSeconds: 0,
        },
      ],
      dailyReports: [
        {
          id: 3,
          userId: 1,
          reportDate: '2026-06-05',
          content: 'daily',
          generatorType: 'RULE_BASED',
          createdAt: '2026-06-05T03:00:00.000Z',
          updatedAt: '2026-06-05T03:00:00.000Z',
        },
      ],
      weeklyReviews: [
        {
          id: 4,
          userId: 1,
          weekStartDate: '2026-06-01',
          weekEndDate: '2026-06-07',
          content: 'weekly',
          generatorType: 'RULE_BASED',
          createdAt: '2026-06-05T03:00:00.000Z',
          updatedAt: '2026-06-05T03:00:00.000Z',
        },
      ],
      sequences: {},
    }),
  );
}

function writeTaggedJsonFixture(jsonPath: string, overrides: Record<string, unknown> = {}) {
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      users: [{id: 1, username: 'demo', displayName: 'Demo User', createdAt: ''}],
      categories: [{id: 1, userId: 1, name: '工作', color: '#3b82f6', sortOrder: 1, createdAt: '', updatedAt: ''}],
      tags: [
        {id: 1, userId: 1, name: '客户 A', createdAt: '', updatedAt: ''},
        {id: 2, userId: 1, name: 'P 项目', createdAt: '', updatedAt: ''},
      ],
      tasks: [
        {id: 1, userId: 1, categoryId: 1, title: '带标签任务', priority: 'P1', status: 'TODO', createdAt: '', updatedAt: ''},
        {id: 2, userId: 1, categoryId: 1, title: '历史任务', status: 'TODO', createdAt: '', updatedAt: ''},
      ],
      taskTags: [{taskId: 1, tagId: 1, userId: 1, createdAt: ''}],
      taskExecutionSessions: [],
      dailyReports: [],
      weeklyReviews: [],
      ...overrides,
    }),
  );
}

describe('importJsonToSqlite', () => {
  it('imports JSON data into SQLite while preserving ids and relationships', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeJsonFixture(jsonPath);

    const result = importJsonToSqlite({jsonPath, sqlitePath});

    expect(result).toEqual({
      users: 1,
      categories: 1,
      tags: 0,
      tasks: 1,
      taskTags: 0,
      taskExecutionSessions: 1,
      dailyReports: 1,
      weeklyReviews: 1,
    });

    const db = openSqliteClient(sqlitePath);
    expect(db.prepare('select id, name from categories').get()).toEqual({id: 7, name: '学习'});
    expect(db.prepare('select id, category_id, title from tasks').get()).toEqual({
      id: 11,
      category_id: 7,
      title: '复习数学',
    });
    expect(db.prepare('select id, task_id, task_title from task_execution_sessions').get()).toEqual({
      id: 13,
      task_id: 11,
      task_title: '复习数学',
    });
    expect(db.prepare('select id, report_date from daily_reports').get()).toEqual({id: 3, report_date: '2026-06-05'});
    expect(db.prepare('select id, week_start_date from weekly_reviews').get()).toEqual({
      id: 4,
      week_start_date: '2026-06-01',
    });
    db.close();
  });

  it('refuses to import into a database with existing business data unless force is enabled', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeJsonFixture(jsonPath);
    importJsonToSqlite({jsonPath, sqlitePath});

    expect(() => importJsonToSqlite({jsonPath, sqlitePath})).toThrow(
      'SQLite database already contains business data. Re-run with force to replace it.',
    );
  });

  it('clears existing business data before importing when force is enabled', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeJsonFixture(jsonPath);
    importJsonToSqlite({jsonPath, sqlitePath});

    const db = openSqliteClient(sqlitePath);
    db.prepare(
      'insert into categories (id, user_id, name, color, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
    ).run(99, 1, '临时', '#000000', 99, '2026-06-05T00:00:00.000Z', '2026-06-05T00:00:00.000Z');
    db.close();

    const result = importJsonToSqlite({jsonPath, sqlitePath, force: true});

    expect(result.categories).toBe(1);
    const reloaded = openSqliteClient(sqlitePath);
    expect(reloaded.prepare('select id, name from categories order by id').all()).toEqual([{id: 7, name: '学习'}]);
    reloaded.close();
  });

  it('imports legacy and scheduled task fields', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        users: [
          {
            id: 1,
            username: 'demo',
            displayName: 'Demo User',
            createdAt: '',
          },
        ],
        categories: [
          {
            id: 1,
            userId: 1,
            name: '工作',
            color: '#ef4444',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ],
        tasks: [
          {
            id: 1,
            userId: 1,
            categoryId: 1,
            title: '旧任务',
            plannedDate: '2026-06-06',
            startAt: '2026-06-06T09:00:00.000',
            endAt: '2026-06-06T10:00:00.000',
            allDay: true,
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
        ],
      }),
    );

    importJsonToSqlite({jsonPath, sqlitePath});

    const db = openSqliteClient(sqlitePath);
    expect(
      db.prepare('select id, title, planned_end_date, start_at, end_at, all_day from tasks order by id').all(),
    ).toEqual([
      {
        id: 1,
        title: '旧任务',
        planned_end_date: null,
        start_at: null,
        end_at: null,
        all_day: 1,
      },
      {
        id: 2,
        title: '会议',
        planned_end_date: null,
        start_at: '2026-06-06T09:00:00.000',
        end_at: '2026-06-06T10:00:00.000',
        all_day: 0,
      },
    ]);
    db.close();
  });

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

  it('imports empty plannedDate as nullable sqlite planned_date', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    fs.writeFileSync(jsonPath, JSON.stringify({
      users: [{id: 1, username: 'demo', displayName: 'Demo', createdAt: '2026-06-06T00:00:00.000Z'}],
      categories: [{id: 1, userId: 1, name: '工作', color: '#000000', sortOrder: 1, createdAt: '2026-06-06T00:00:00.000Z', updatedAt: '2026-06-06T00:00:00.000Z'}],
      tasks: [{
        id: 1,
        userId: 1,
        categoryId: 1,
        title: '空日期',
        plannedDate: '',
        status: 'TODO',
        createdAt: '2026-06-06T00:00:00.000Z',
        updatedAt: '2026-06-06T00:00:00.000Z',
      }],
    }));

    importJsonToSqlite({jsonPath, sqlitePath});

    const db = openSqliteClient(sqlitePath);
    try {
      expect(db.prepare('select planned_date, all_day from tasks where id = 1').get()).toEqual({
        planned_date: null,
        all_day: 1,
      });
    } finally {
      db.close();
    }
  });

  it('imports tags and task tag associations', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeTaggedJsonFixture(jsonPath);

    const result = importJsonToSqlite({jsonPath, sqlitePath, force: true});

    expect(result.tags).toBe(2);
    expect(result.taskTags).toBe(1);
  });

  it('imports task priority values and defaults missing priority to null', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeTaggedJsonFixture(jsonPath);

    importJsonToSqlite({jsonPath, sqlitePath, force: true});

    const db = openSqliteClient(sqlitePath);
    const rows = db.prepare('select id, priority from tasks order by id asc').all() as Array<{
      id: number;
      priority: string | null;
    }>;
    expect(rows).toEqual([
      {id: 1, priority: 'P1'},
      {id: 2, priority: null},
    ]);
    db.close();
  });

  it('rolls back orphan task tag imports', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeTaggedJsonFixture(jsonPath, {
      tasks: [],
      tags: [{id: 1, userId: 1, name: 'A', createdAt: '', updatedAt: ''}],
      taskTags: [{taskId: 999, tagId: 1, userId: 1, createdAt: ''}],
    });

    expect(() => importJsonToSqlite({jsonPath, sqlitePath, force: true})).toThrow('Invalid taskTags association');
  });

  it('rolls back force clear and import in one transaction', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeTaggedJsonFixture(jsonPath);
    importJsonToSqlite({jsonPath, sqlitePath, force: true});
    writeTaggedJsonFixture(jsonPath, {
      tasks: [],
      tags: [{id: 1, userId: 1, name: 'A', createdAt: '', updatedAt: ''}],
      taskTags: [{taskId: 999, tagId: 1, userId: 1, createdAt: ''}],
    });

    expect(() => importJsonToSqlite({jsonPath, sqlitePath, force: true})).toThrow('Invalid taskTags association');
    const db = openSqliteClient(sqlitePath);
    expect((db.prepare('select count(*) as count from tasks').get() as {count: number}).count).toBeGreaterThan(0);
    db.close();
  });

  it('rejects cross-user task tag imports', () => {
    const {jsonPath, sqlitePath} = createTestFiles();
    writeTaggedJsonFixture(jsonPath, {
      users: [
        {id: 1, username: 'u1', displayName: 'U1', createdAt: ''},
        {id: 2, username: 'u2', displayName: 'U2', createdAt: ''},
      ],
      tags: [{id: 1, userId: 2, name: '外部', createdAt: '', updatedAt: ''}],
      taskTags: [{taskId: 1, tagId: 1, userId: 1, createdAt: ''}],
    });

    expect(() => importJsonToSqlite({jsonPath, sqlitePath, force: true})).toThrow('Invalid taskTags association');
  });
});
