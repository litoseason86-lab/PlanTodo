import path from 'node:path';

import type {CategoryRepository} from '../modules/categories/repository';
import type {FocusSessionRepository} from '../modules/focus/repository';
import type {ReportRepository} from '../modules/reports/repository';
import type {TaskRepository} from '../modules/tasks/repository';
import {JsonFileStore} from './json/fileStore';
import {CategoryJsonRepository} from './json/repositories/categoryJsonRepository';
import {FocusSessionJsonRepository} from './json/repositories/focusSessionJsonRepository';
import {ReportJsonRepository} from './json/repositories/reportJsonRepository';
import {TaskJsonRepository} from './json/repositories/taskJsonRepository';
import {openSqliteClient} from './sqlite/sqliteClient';
import {CategorySqliteRepository} from './sqlite/repositories/categorySqliteRepository';
import {FocusSessionSqliteRepository} from './sqlite/repositories/focusSessionSqliteRepository';
import {ReportSqliteRepository} from './sqlite/repositories/reportSqliteRepository';
import {TaskSqliteRepository} from './sqlite/repositories/taskSqliteRepository';

export interface AppRepositories {
  categories: CategoryRepository;
  tasks: TaskRepository;
  focusSessions: FocusSessionRepository;
  reports: ReportRepository;
}

export function createRepositoriesFromEnv(env: NodeJS.ProcessEnv = process.env): AppRepositories {
  const driver = env.STORAGE_DRIVER ?? 'sqlite';

  if (driver === 'json') {
    const store = new JsonFileStore(path.resolve(env.JSON_DB_PATH ?? 'data/db.json'));
    return {
      categories: new CategoryJsonRepository(store),
      tasks: new TaskJsonRepository(store),
      focusSessions: new FocusSessionJsonRepository(store),
      reports: new ReportJsonRepository(store),
    };
  }

  if (driver === 'sqlite') {
    const db = openSqliteClient(path.resolve(env.SQLITE_DB_PATH ?? 'data/plantode.sqlite'));
    return {
      categories: new CategorySqliteRepository(db),
      tasks: new TaskSqliteRepository(db),
      focusSessions: new FocusSessionSqliteRepository(db),
      reports: new ReportSqliteRepository(db),
    };
  }

  throw new Error(`Unsupported STORAGE_DRIVER "${driver}"`);
}
