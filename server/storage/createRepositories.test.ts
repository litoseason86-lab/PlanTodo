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
