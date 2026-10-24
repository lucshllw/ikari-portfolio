import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import Database from 'better-sqlite3';

it('CLI migration creates fresh persistent schema; non-interactive owner creation stays closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'frame-cli-'));
  try {
    const env = { ...process.env, DATA_DIR: directory };
    const migrated = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], { env, encoding: 'utf8' });
    expect(migrated.status).toBe(0);
    const provisioned = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/admin-create.ts'], { env, encoding: 'utf8' });
    expect(provisioned.status).toBe(1);
    const connection = new Database(join(directory, 'frame.sqlite'));
    try {
      expect(connection.pragma('user_version', { simple: true })).toBe(3);
      expect(connection.prepare('SELECT COUNT(*) AS n FROM owner').get()).toMatchObject({ n: 0 });
    } finally { connection.close(); }
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Invalid cleanup directory');
    rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}, 30_000);
