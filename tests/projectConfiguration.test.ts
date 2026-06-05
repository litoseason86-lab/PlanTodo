import fs from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

const projectRoot = path.resolve(__dirname, '..');

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf-8')) as T;
}

describe('project configuration', () => {
  it('builds a production server bundle and starts it with node', () => {
    const packageJson = readJsonFile<{
      scripts: Record<string, string>;
    }>('package.json');

    expect(packageJson.scripts.build).toContain('vite build');
    expect(packageJson.scripts.build).toContain('esbuild server.ts');
    expect(packageJson.scripts.start).toBe('NODE_ENV=production node dist/server.js');
  });

  it('does not declare unused GenAI configuration or dependencies', () => {
    const packageJson = readJsonFile<{
      dependencies?: Record<string, string>;
    }>('package.json');
    const metadata = readJsonFile<{
      majorCapabilities?: string[];
    }>('metadata.json');
    const envExample = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf-8');

    expect(packageJson.dependencies ?? {}).not.toHaveProperty('@google/genai');
    expect(metadata.majorCapabilities ?? []).not.toContain('MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API');
    expect(envExample).not.toContain('GEMINI');
  });

  it('enforces strict TypeScript hygiene', () => {
    const tsconfig = readJsonFile<{
      compilerOptions: Record<string, unknown>;
    }>('tsconfig.json');

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedLocals).toBe(true);
    expect(tsconfig.compilerOptions.noUnusedParameters).toBe(true);
  });
});
