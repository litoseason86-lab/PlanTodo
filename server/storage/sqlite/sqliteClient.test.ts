import {afterEach, describe, expect, it} from 'vitest';

import {openSqliteClient} from './sqliteClient';
import {createTestSqliteFile, type TestSqliteFile} from './testSqlite';

let sqliteFile: TestSqliteFile | undefined;

afterEach(() => {
  sqliteFile?.cleanup();
  sqliteFile = undefined;
});

describe('openSqliteClient', () => {
  it('creates schema tables and seeds demo user', () => {
    sqliteFile = createTestSqliteFile('plantodo-sqlite-client');
    const db = openSqliteClient(sqliteFile.filePath);

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all() as Array<{name: string}>;

    expect(tables.map((table) => table.name)).toEqual([
      'categories',
      'daily_reports',
      'schema_migrations',
      'task_execution_sessions',
      'tasks',
      'users',
      'weekly_reviews',
    ]);

    expect(db.prepare('select id, username, display_name from users where id = 1').get()).toEqual({
      id: 1,
      username: 'demo',
      display_name: 'Demo User',
    });

    expect(db.pragma('foreign_keys', {simple: true})).toBe(1);

    db.close();
  });

  it('runs migrations idempotently', () => {
    sqliteFile = createTestSqliteFile('plantodo-sqlite-idempotent');

    const first = openSqliteClient(sqliteFile.filePath);
    first.close();

    const second = openSqliteClient(sqliteFile.filePath);
    const migrations = second.prepare('select version from schema_migrations order by version').all();

    expect(migrations).toEqual([{version: 1}, {version: 2}, {version: 3}]);

    second.close();
  });
});
