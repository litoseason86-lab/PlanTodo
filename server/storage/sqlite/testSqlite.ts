import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TestSqliteFile {
  filePath: string;
  cleanup: () => void;
}

export function createTestSqliteFile(prefix: string): TestSqliteFile {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(directory, 'test.sqlite');

  return {
    filePath,
    cleanup() {
      fs.rmSync(directory, {recursive: true, force: true});
    },
  };
}
