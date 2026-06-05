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

  it('pauses, resumes, and excludes paused time when stopped', () => {
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const task = tasks.create({userId: 1, categoryId: category.id, title: '写方案', plannedDate: '2026-06-05'});
    const running = sessions.createRunning({
      taskId: task.id,
      userId: 1,
      startedAt: '2026-06-05T01:00:00.000Z',
    });

    const paused = sessions.pause({
      sessionId: running.id,
      userId: 1,
      pausedAt: '2026-06-05T01:10:00.000Z',
    });
    expect(paused).toMatchObject({
      status: 'PAUSED',
      pausedAt: '2026-06-05T01:10:00.000Z',
      accumulatedPauseSeconds: 0,
    });
    expect(sessions.getRunningByUser(1)?.status).toBe('PAUSED');

    const resumed = sessions.resume({
      sessionId: running.id,
      userId: 1,
      resumedAt: '2026-06-05T01:30:00.000Z',
    });
    expect(resumed).toMatchObject({
      status: 'RUNNING',
      pausedAt: undefined,
      accumulatedPauseSeconds: 1200,
    });

    const stopped = sessions.stop({
      sessionId: running.id,
      userId: 1,
      endedAt: '2026-06-05T02:00:00.000Z',
    });

    expect(stopped).toMatchObject({
      status: 'COMPLETED',
      durationSeconds: 2400,
      accumulatedPauseSeconds: 1200,
    });
  });
});
