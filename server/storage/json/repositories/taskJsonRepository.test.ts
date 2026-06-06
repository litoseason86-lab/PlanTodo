import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {createEmptyDatabaseSchema} from '../../databaseSchema';
import {JsonFileStore} from '../fileStore';
import {TaskJsonRepository} from './taskJsonRepository';

const createdPaths: string[] = [];

function createTempFilePath(): string {
  const filePath = path.join(
    os.tmpdir(),
    `plantodo-task-repository-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
  createdPaths.push(filePath);
  return filePath;
}

afterEach(() => {
  for (const filePath of createdPaths.splice(0)) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe('TaskJsonRepository', () => {
  it('filters tasks by user, date and category', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const schema = createEmptyDatabaseSchema();
    schema.tasks = [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: 'Task A',
        plannedDate: '2026-06-05',
        allDay: true,
        status: 'TODO',
        createdAt: '2026-06-05T08:00:00.000Z',
        updatedAt: '2026-06-05T08:00:00.000Z',
      },
      {
        id: 2,
        userId: 1,
        categoryId: 2,
        title: 'Task B',
        plannedDate: '2026-06-06',
        allDay: true,
        status: 'DONE',
        createdAt: '2026-06-05T09:00:00.000Z',
        updatedAt: '2026-06-05T09:00:00.000Z',
      },
      {
        id: 3,
        userId: 2,
        categoryId: 1,
        title: 'Task C',
        plannedDate: '2026-06-05',
        allDay: true,
        status: 'TODO',
        createdAt: '2026-06-05T10:00:00.000Z',
        updatedAt: '2026-06-05T10:00:00.000Z',
      },
    ];
    schema.sequences.tasks = 3;
    store.write(schema);

    const repository = new TaskJsonRepository(store);

    expect(
      repository.listByFilters({
        userId: 1,
        plannedDate: '2026-06-05',
      }),
    ).toMatchObject([{id: 1, title: 'Task A'}]);

    expect(
      repository.listByFilters({
        userId: 1,
        categoryId: 2,
      }),
    ).toMatchObject([{id: 2, title: 'Task B'}]);
  });

  it('creates and updates task status through the store', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);

    const task = repository.create({
      userId: 1,
      categoryId: 3,
      title: '  New Task  ',
      plannedDate: '2026-06-05',
    });

    expect(task).toMatchObject({
      id: 1,
      title: 'New Task',
      status: 'TODO',
    });

    const updated = repository.updateStatus(task.id, 1, 'DONE');

    expect(updated).toMatchObject({
      id: 1,
      status: 'DONE',
    });
    expect(repository.getById(task.id, 1)?.status).toBe('DONE');
  });

  it('removes a task and its execution sessions', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const schema = createEmptyDatabaseSchema();
    schema.tasks = [
      {
        id: 1,
        userId: 1,
        categoryId: 1,
        title: 'Task A',
        plannedDate: '2026-06-05',
        allDay: true,
        status: 'TODO',
        createdAt: '2026-06-05T08:00:00.000Z',
        updatedAt: '2026-06-05T08:00:00.000Z',
      },
      {
        id: 2,
        userId: 1,
        categoryId: 1,
        title: 'Task B',
        plannedDate: '2026-06-05',
        allDay: true,
        status: 'TODO',
        createdAt: '2026-06-05T09:00:00.000Z',
        updatedAt: '2026-06-05T09:00:00.000Z',
      },
    ];
    schema.taskExecutionSessions = [
      {
        id: 1,
        taskId: 1,
        userId: 1,
        startedAt: '2026-06-05T08:00:00.000Z',
        status: 'RUNNING',
        createdAt: '2026-06-05T08:00:00.000Z',
      },
      {
        id: 2,
        taskId: 2,
        userId: 1,
        startedAt: '2026-06-05T09:00:00.000Z',
        status: 'RUNNING',
        createdAt: '2026-06-05T09:00:00.000Z',
      },
    ];
    store.write(schema);

    const repository = new TaskJsonRepository(store);

    expect(repository.remove(1, 1)).toBe(true);
    expect(repository.remove(99, 1)).toBe(false);

    const data = store.read();
    expect(data.tasks.map((task) => task.id)).toEqual([2]);
    expect(data.taskExecutionSessions.map((session) => session.id)).toEqual([2]);
  });

  it('normalizes legacy tasks and filters by schedule range', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);

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
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);

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

  it('creates and filters unscheduled json tasks', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);

    const unscheduled = repository.create({
      userId: 1,
      categoryId: 1,
      title: '  未排期  ',
      plannedDate: undefined,
      allDay: true,
    });
    repository.create({
      userId: 1,
      categoryId: 1,
      title: '已排期',
      plannedDate: '2026-06-06',
      allDay: true,
    });

    expect(unscheduled).toMatchObject({
      title: '未排期',
      plannedDate: undefined,
      allDay: true,
    });
    expect(repository.listByFilters({userId: 1}).map((task) => task.title)).toEqual(['未排期', '已排期']);
    expect(repository.listByFilters({userId: 1, scheduled: 'unscheduled'}).map((task) => task.title)).toEqual(['未排期']);
    expect(repository.listByFilters({userId: 1, plannedDate: '2026-06-06'}).map((task) => task.title)).toEqual(['已排期']);
  });

  it('filters json all-day-without-time tasks and query text', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const schema = createEmptyDatabaseSchema();
    schema.tasks = [
      {id: 1, userId: 1, categoryId: 1, title: '写周报', plannedDate: '2026-06-06', allDay: true, status: 'TODO', createdAt: '1', updatedAt: '1'},
      {id: 2, userId: 1, categoryId: 1, title: '周报跨天', plannedDate: '2026-06-06', plannedEndDate: '2026-06-07', allDay: true, status: 'TODO', createdAt: '2', updatedAt: '2'},
      {id: 3, userId: 1, categoryId: 1, title: '会议周报', plannedDate: '2026-06-06', startAt: '2026-06-06T09:00:00.000', endAt: '2026-06-06T10:00:00.000', allDay: false, status: 'TODO', createdAt: '3', updatedAt: '3'},
    ];
    schema.sequences.tasks = 3;
    store.write(schema);

    const repository = new TaskJsonRepository(store);

    expect(repository.listByFilters({
      userId: 1,
      scheduled: 'all-day-without-time',
      dateFrom: '2026-06-01',
      dateTo: '2026-06-07',
      query: '周报',
    }).map((task) => task.title)).toEqual(['写周报']);
  });

  it('batch updates json schedules in a single store update', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);
    const first = repository.create({userId: 1, categoryId: 1, title: 'A', plannedDate: undefined, allDay: true});
    const second = repository.create({userId: 1, categoryId: 1, title: 'B', plannedDate: undefined, allDay: true});

    const updated = repository.batchUpdateSchedules([
      {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
      {taskId: second.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
    ]);

    expect(updated.map((task) => task.plannedDate)).toEqual(['2026-06-08', '2026-06-08']);
  });

  it('does not partially update json schedules when a batch task is missing', () => {
    const filePath = createTempFilePath();
    const store = new JsonFileStore(filePath);
    const repository = new TaskJsonRepository(store);
    const first = repository.create({userId: 1, categoryId: 1, title: 'A', plannedDate: undefined, allDay: true});

    expect(() => repository.batchUpdateSchedules([
      {taskId: first.id, userId: 1, plannedDate: '2026-06-08', allDay: true},
      {taskId: 999, userId: 1, plannedDate: '2026-06-08', allDay: true},
    ])).toThrow('Task not found');

    expect(repository.getById(first.id, 1)?.plannedDate).toBeUndefined();
  });
});
