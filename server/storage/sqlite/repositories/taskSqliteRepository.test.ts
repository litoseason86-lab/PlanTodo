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

  it('removes a task and its execution sessions', () => {
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const task = tasks.create({userId: 1, categoryId: category.id, title: '写方案', plannedDate: '2026-06-05'});
    db.prepare(
      'insert into task_execution_sessions (task_id, user_id, started_at, status, created_at) values (?, ?, ?, ?, ?)',
    ).run(task.id, 1, '2026-06-05T08:00:00.000Z', 'RUNNING', '2026-06-05T08:00:00.000Z');

    expect(tasks.remove(task.id, 1)).toBe(true);
    expect(tasks.remove(999, 1)).toBe(false);
    expect(tasks.getById(task.id, 1)).toBeUndefined();
    expect(db.prepare('select count(*) as count from task_execution_sessions where task_id = ?').get(task.id)).toEqual({
      count: 0,
    });
  });
});
