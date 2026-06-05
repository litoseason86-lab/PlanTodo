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
    `plantode-task-repository-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
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
});
