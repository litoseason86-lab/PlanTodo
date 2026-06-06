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
  sqliteFile = createTestSqliteFile('plantodo-task-repository');
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

  it('persists schedule fields and filters intersecting ranges', () => {
    const category = categories.create({userId: 1, name: '工作', color: '#ef4444', sortOrder: 1});
    const task = tasks.create({
      userId: 1,
      categoryId: category.id,
      title: '跨天',
      plannedDate: '2026-06-05',
      plannedEndDate: '2026-06-07',
      allDay: true,
    });

    expect(task).toMatchObject({plannedEndDate: '2026-06-07', allDay: true});
    expect(
      tasks.listByFilters({userId: 1, dateFrom: '2026-06-06', dateTo: '2026-06-06'}).map((item) => item.title),
    ).toEqual(['跨天']);

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
});
