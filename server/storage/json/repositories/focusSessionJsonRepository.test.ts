import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {createEmptyDatabaseSchema} from '../../databaseSchema';
import {JsonFileStore} from '../fileStore';
import {FocusSessionJsonRepository} from './focusSessionJsonRepository';

const createdPaths: string[] = [];

function createTempFilePath(): string {
  const filePath = path.join(
    os.tmpdir(),
    `plantode-focus-repository-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
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

describe('FocusSessionJsonRepository', () => {
  it('pauses, resumes, and excludes paused time when stopped', () => {
    const store = new JsonFileStore(createTempFilePath());
    const schema = createEmptyDatabaseSchema();
    schema.taskExecutionSessions = [
      {
        id: 1,
        taskId: 2,
        userId: 1,
        startedAt: '2026-06-05T01:00:00.000Z',
        status: 'RUNNING',
        createdAt: '2026-06-05T01:00:00.000Z',
      },
    ];
    store.write(schema);

    const repository = new FocusSessionJsonRepository(store);

    expect(repository.pause({
      sessionId: 1,
      userId: 1,
      pausedAt: '2026-06-05T01:10:00.000Z',
    })).toMatchObject({
      status: 'PAUSED',
      pausedAt: '2026-06-05T01:10:00.000Z',
      accumulatedPauseSeconds: 0,
    });

    expect(repository.resume({
      sessionId: 1,
      userId: 1,
      resumedAt: '2026-06-05T01:30:00.000Z',
    })).toMatchObject({
      status: 'RUNNING',
      pausedAt: undefined,
      accumulatedPauseSeconds: 1200,
    });

    expect(repository.stop({
      sessionId: 1,
      userId: 1,
      endedAt: '2026-06-05T02:00:00.000Z',
    })).toMatchObject({
      status: 'COMPLETED',
      durationSeconds: 2400,
      accumulatedPauseSeconds: 1200,
    });
  });
});
