import fs from 'node:fs';
import path from 'node:path';

import {
  createEmptyDatabaseSchema,
  type DatabaseSchema,
} from '../databaseSchema';

function normalizeSchema(data: Partial<DatabaseSchema>): DatabaseSchema {
  const base = createEmptyDatabaseSchema();

  return {
    ...base,
    ...data,
    users: data.users ?? base.users,
    categories: data.categories ?? base.categories,
    tasks: data.tasks ?? base.tasks,
    taskExecutionSessions: data.taskExecutionSessions ?? base.taskExecutionSessions,
    dailyReports: data.dailyReports ?? base.dailyReports,
    weeklyReviews: data.weeklyReviews ?? base.weeklyReviews,
    sequences: {
      ...base.sequences,
      ...(data.sequences ?? {}),
    },
  };
}

export class JsonFileStore {
  constructor(private readonly filePath: string) {}

  private ensureFile(): void {
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {recursive: true});
    }

    if (!fs.existsSync(this.filePath)) {
      this.write(createEmptyDatabaseSchema());
    }
  }

  read(): DatabaseSchema {
    this.ensureFile();

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;

    return normalizeSchema(parsed);
  }

  write(data: DatabaseSchema): void {
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {recursive: true});
    }

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  update<T>(mutator: (data: DatabaseSchema) => T): T {
    const data = this.read();
    const result = mutator(data);
    this.write(data);
    return result;
  }
}

