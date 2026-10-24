import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createBackup, checkRestore } from '../scripts/operations';

const mediaId = 'e7882146-92ee-4711-a51d-1c781747f531';
const installationId = '00000000-0000-4000-8000-000000000001';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let root: string, live: string, bundle: string, destination: string, image: Buffer;
let initialDatabase: Buffer;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'frame-operations-test-'));
  live = join(root, 'live'); bundle = join(root, 'package'); destination = join(root, 'restored');
  mkdirSync(join(live, 'media'), { recursive: true }); mkdirSync(join(live, 'originals'));
  image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f15e39' } }).webp().toBuffer();
  writeFileSync(join(live, 'media', `${mediaId}.webp`), image);
  writeFileSync(join(live, 'originals', `${mediaId}.webp`), image);
  const db = new Database(join(live, 'frame.sqlite'));
  db.pragma('foreign_keys = ON'); db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE installation (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL, schemaVersion INTEGER NOT NULL);
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE owner (id INTEGER PRIMARY KEY, userId TEXT REFERENCES user(id));
    CREATE TABLE account (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id), password TEXT);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id), token TEXT);
    CREATE TABLE verification (id TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE categories (id TEXT PRIMARY KEY);
    CREATE TABLE media (id TEXT PRIMARY KEY, filename TEXT, checksum TEXT, size INTEGER);
    CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT, coverMediaId TEXT REFERENCES media(id), status TEXT);
    CREATE TABLE site_settings (id INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE inquiries (id TEXT PRIMARY KEY, name TEXT, email TEXT, brief TEXT);
    CREATE TABLE audit (id TEXT PRIMARY KEY);
    PRAGMA user_version = 1;
    INSERT INTO user VALUES ('owner-test','owner@example.test');
    INSERT INTO owner VALUES (1,'owner-test');
    INSERT INTO account VALUES ('account-test','owner-test','synthetic-hash');
    INSERT INTO session VALUES ('session-test','owner-test','synthetic-token');
    INSERT INTO verification VALUES ('verification-test','synthetic-reset-token');
    INSERT INTO site_settings VALUES (1,'{"brandName":"Synthetic Studio"}');
    INSERT INTO inquiries VALUES ('inquiry-test','Synthetic person','person@example.test','Synthetic brief');
  `);
  db.prepare('INSERT INTO installation VALUES (1,?,1)').run(installationId);
  db.prepare('INSERT INTO media VALUES (?,?,?,?)').run(mediaId, `${mediaId}.webp`, hash(image), image.length);
  db.prepare('INSERT INTO projects VALUES (?,?,?,?)').run('project-test', 'Synthetic motion', mediaId, 'draft');
  db.close(); initialDatabase = readFileSync(join(live, 'frame.sqlite'));
  // Pacote de referência construído independentemente do gerador sob teste.
  mkdirSync(join(bundle, 'media'), { recursive: true }); mkdirSync(join(bundle, 'originals'));
  const paths = ['frame.sqlite', `media/${mediaId}.webp`, `originals/${mediaId}.webp`];
  for (const path of paths) copyFileSync(join(live, path), join(bundle, path));
  writeFileSync(join(bundle, 'manifest.json'), JSON.stringify({
    format: 'frame-backup', version: 1, backupId: '00000000-0000-4000-8000-000000000002',
    createdAt: '2026-10-13T03:00:00.000Z', installationId, schemaVersion: 1,
    files: paths.map((path) => { const bytes = readFileSync(join(bundle, path)); return { path, size: bytes.length, sha256: hash(bytes) }; })
  }));
});
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

function changeManifest(update: (manifest: any) => void) {
  const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
  update(manifest); writeFileSync(join(bundle, 'manifest.json'), JSON.stringify(manifest));
}
function assertLiveUnchanged() { expect(readFileSync(join(live, 'frame.sqlite'))).toEqual(initialDatabase); }

it('backs up and restores schema2 original publication without altering it', async () => {
  const db = new Database(join(live, 'frame.sqlite'));
  db.exec("ALTER TABLE projects ADD COLUMN sourceUrl TEXT NOT NULL DEFAULT ''; UPDATE projects SET sourceUrl='https://x.com/example/status/123'; UPDATE installation SET schemaVersion=2; PRAGMA user_version=2;");
  db.close();
  const backup = await createBackup({ dataDir: live, destination: join(root, 'schema2-backup'), serverStopped: true });
  expect(JSON.parse(readFileSync(join(backup.directory, 'manifest.json'), 'utf8')).schemaVersion).toBe(2);
  await checkRestore(backup.directory, { dataDir: live, destination });
  const restored = new Database(join(destination, 'frame.sqlite'), { readonly: true });
  try { expect(restored.prepare('SELECT sourceUrl FROM projects').get()).toEqual({ sourceUrl: 'https://x.com/example/status/123' }); expect(restored.pragma('user_version', { simple: true })).toBe(2); }
  finally { restored.close(); }
});

it('rejects a manifest version that disagrees with the backed-up database', async () => {
  changeManifest((m) => { m.schemaVersion = 2; });
  await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/schema|versão/i);
  expect(existsSync(destination)).toBe(false); assertLiveUnchanged();
});

describe('restore refuses unsafe or incomplete packages before touching the destination', () => {
  it('missing manifest cannot be treated as a successful restore', async () => {
    rmSync(join(bundle, 'manifest.json'));
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/manifesto/i);
    expect(existsSync(destination)).toBe(false); assertLiveUnchanged();
  });
  it('missing referenced original is rejected even if the manifest omits it', async () => {
    rmSync(join(bundle, 'originals', `${mediaId}.webp`));
    changeManifest((m) => { m.files = m.files.filter((f: any) => !f.path.startsWith('originals/')); });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/original/i);
    expect(existsSync(destination)).toBe(false); assertLiveUnchanged();
  });
  it.each(['../escape.webp', 'media/../../escape.webp', 'C:/outside.webp', 'media\\..\\escape.webp'])('rejects manipulated manifest path %s', async (path) => {
    changeManifest((m) => { m.files[1].path = path; });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/caminho/i);
    expect(existsSync(join(root, 'escape.webp'))).toBe(false); expect(existsSync(destination)).toBe(false);
  });
  it('altered bytes are refused rather than silently restored', async () => {
    writeFileSync(join(bundle, 'media', `${mediaId}.webp`), 'tampered');
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/hash|integridade|tamanho/i);
    expect(existsSync(destination)).toBe(false); assertLiveUnchanged();
  });
  it('duplicate entries are rejected', async () => {
    changeManifest((m) => { m.files.push(m.files[0]); });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/duplicad/i);
  });
  it('manifest cannot silently omit the database', async () => {
    changeManifest((m) => { m.files = m.files.slice(1); });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/banco/i);
  });
  it('unknown schema cannot be migrated silently during restore', async () => {
    changeManifest((m) => { m.schemaVersion = 500; });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/schema|versão/i);
  });
  it('never overwrites live data or an existing destination', async () => {
    await expect(checkRestore(bundle, { dataDir: live, destination: live })).rejects.toThrow(/destino|ativo/i);
    mkdirSync(destination); writeFileSync(join(destination, 'keep.txt'), 'preserve');
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/existente|destino/i);
    expect(readFileSync(join(destination, 'keep.txt'), 'utf8')).toBe('preserve'); assertLiveUnchanged();
  });
  it('directory junction cannot redirect package media outside its root', async () => {
    const external = join(root, 'external'); mkdirSync(external);
    writeFileSync(join(external, `${mediaId}.webp`), image);
    rmSync(join(bundle, 'media'), { recursive: true });
    symlinkSync(external, join(bundle, 'media'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/link|atalho/i);
  });
  it('unlisted WAL cannot change which database state is restored', async () => {
    writeFileSync(join(bundle, 'frame.sqlite-wal'), 'unlisted-sidecar');
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/arquivo|pacote|WAL/i);
    expect(existsSync(destination)).toBe(false);
  });
  it('corrupt SQLite is refused even if an attacker recalculates its file hash', async () => {
    writeFileSync(join(bundle, 'frame.sqlite'), 'not-a-sqlite-file');
    changeManifest((m) => { m.files[0].sha256 = hash(Buffer.from('not-a-sqlite-file')); m.files[0].size = 17; });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow();
    expect(existsSync(destination)).toBe(false); assertLiveUnchanged();
  });
  it('database installation must match the manifest', async () => {
    changeManifest((m) => { m.installationId = '00000000-0000-4000-8000-000000000050'; });
    await expect(checkRestore(bundle, { dataDir: live, destination })).rejects.toThrow(/instalação/i);
  });
});

describe('verified operations on disposable data', () => {
  it('restores image, draft, identity, inquiry and owner; revokes copied sessions only', async () => {
    const result = await checkRestore(bundle, { dataDir: live, destination });
    const db = new Database(join(result.directory, 'frame.sqlite'), { readonly: true });
    try {
      expect(db.prepare('SELECT title,status FROM projects').get()).toEqual({ title: 'Synthetic motion', status: 'draft' });
      expect(db.prepare('SELECT value FROM site_settings').get()).toEqual({ value: '{"brandName":"Synthetic Studio"}' });
      expect(db.prepare('SELECT brief FROM inquiries').get()).toEqual({ brief: 'Synthetic brief' });
      expect(db.prepare('SELECT userId FROM owner').get()).toEqual({ userId: 'owner-test' });
      expect(db.prepare('SELECT password FROM account').get()).toEqual({ password: 'synthetic-hash' });
      expect(db.prepare('SELECT COUNT(*) AS n FROM session').get()).toEqual({ n: 0 });
      expect(db.prepare('SELECT COUNT(*) AS n FROM verification').get()).toEqual({ n: 0 });
      expect(readFileSync(join(result.directory, 'media', `${mediaId}.webp`))).toEqual(image);
    } finally { db.close(); }
    assertLiveUnchanged();
    expect(readFileSync(join(bundle, 'frame.sqlite'))).toEqual(initialDatabase);
  });
  it('backs up with API snapshot and restores separately without secrets or tmp files', async () => {
    mkdirSync(join(live, 'tmp')); writeFileSync(join(live, 'tmp', 'pending'), 'do not copy');
    writeFileSync(join(live, 'auth-secret'), 'never include');
    const backup = await createBackup({ dataDir: live, destination: join(root, 'backup'), serverStopped: true });
    expect(readdirSync(backup.directory).sort()).toEqual(['frame.sqlite', 'manifest.json', 'media', 'originals']);
    const restored = await checkRestore(backup.directory, { dataDir: live, destination });
    expect(readFileSync(join(restored.directory, 'originals', `${mediaId}.webp`))).toEqual(image);
    assertLiveUnchanged();
  });
  it('backup requires explicit declaration that all writers have stopped', async () => {
    await expect(createBackup({ dataDir: live, destination, serverStopped: false })).rejects.toThrow(/parado/i);
    expect(existsSync(destination)).toBe(false);
  });
  it('backup refuses an existing output or output inside live data', async () => {
    await expect(createBackup({ dataDir: live, destination: join(live, 'backup'), serverStopped: true })).rejects.toThrow(/destino/i);
    await expect(createBackup({ dataDir: live, destination: bundle, serverStopped: true })).rejects.toThrow(/existente|destino/i);
    assertLiveUnchanged();
  });
  it('backup with a missing image fails without promoting a partial package', async () => {
    rmSync(join(live, 'media', `${mediaId}.webp`));
    await expect(createBackup({ dataDir: live, destination, serverStopped: true })).rejects.toThrow();
    expect(existsSync(destination)).toBe(false);
    expect(readdirSync(root).some((p) => p.includes('.partial'))).toBe(false);
  });
  it('API snapshot includes committed rows still present only in WAL', async () => {
    const writer = new Database(join(live, 'frame.sqlite'));
    writer.pragma('journal_mode = WAL'); writer.pragma('wal_autocheckpoint = 0');
    writer.prepare('INSERT INTO inquiries VALUES (?,?,?,?)').run('wal-test', 'Synthetic WAL', 'wal@example.test', 'Committed WAL row');
    expect(existsSync(join(live, 'frame.sqlite-wal'))).toBe(true);
    try {
      const result = await createBackup({ dataDir: live, destination: join(root, 'wal-backup'), serverStopped: true });
      const restored = await checkRestore(result.directory, { dataDir: live, destination });
      const db = new Database(join(restored.directory, 'frame.sqlite'), { readonly: true });
      try { expect(db.prepare('SELECT brief FROM inquiries WHERE id=?').get('wal-test')).toEqual({ brief: 'Committed WAL row' }); }
      finally { db.close(); }
    } finally { writer.close(); }
  });
  it('CLI backup and restore report verified outputs without changing live data', async () => {
    const run = promisify(execFile), env = { ...process.env, DATA_DIR: live };
    const output = join(root, 'cli-backup');
    const backup = await run(process.execPath, ['--import', 'tsx', 'scripts/backup.ts', '--server-stopped', output], { env, timeout: 20_000 });
    expect(JSON.parse(backup.stdout)).toMatchObject({ status: 'verified', files: 3, counts: { inquiries: 1 } });
    const restore = await run(process.execPath, ['--import', 'tsx', 'scripts/restore-check.ts', output], { env, timeout: 20_000 });
    const result = JSON.parse(restore.stdout);
    try {
      expect(result).toMatchObject({ status: 'verified', sessionsRevoked: true, counts: { projects: 1, media: 1, inquiries: 1 } });
      expect(result.directory.startsWith(tmpdir())).toBe(true); assertLiveUnchanged();
      expect(restore.stdout).not.toContain('person@example.test');
    } finally {
      // Remove somente a pasta temporária exclusiva informada pelo comando testado.
      if (typeof result.directory === 'string' && result.directory.startsWith(join(tmpdir(), 'frame-restore-check-'))) rmSync(result.directory, { recursive: true, force: true });
    }
  }, 45_000);
});
