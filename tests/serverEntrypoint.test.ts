import {spawnSync} from 'node:child_process';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const projectRoot = path.resolve(__dirname, '..');
const tsxBin = path.join(projectRoot, 'node_modules', '.bin', 'tsx');

describe('server entrypoint', () => {
  it('exits with a non-zero status when bootstrap fails', () => {
    const result = spawnSync(tsxBin, ['server.ts'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SQLITE_DB_PATH: '/dev/null/plantode.sqlite',
        STORAGE_DRIVER: 'sqlite',
      },
      timeout: 5000,
    });

    expect(`${result.stdout}\n${result.stderr}`).toContain('[Server Fail] Bootstrap error:');
    expect(result.status).not.toBe(0);
  });
});
