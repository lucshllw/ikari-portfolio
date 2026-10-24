import { beforeAll, afterAll, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'frame-source-url-'));
process.env.DATA_DIR = directory;
process.env.BETTER_AUTH_SECRET = 'test-only-source-url-secret-at-least-thirty-two-characters';
process.env.ORIGIN = 'http://localhost:4173';
const legacyId = '10000000-0000-4000-8000-000000000001';
const installationId = '10000000-0000-4000-8000-000000000002';
let storage: typeof import('../src/lib/server/db');
let projects: typeof import('../src/lib/server/projects');
let owner: string;
const input = (slug: string) => ({ slug, title: 'Source example', summary: '', description: '', categoryId: null, coverMediaId: null, coverUrl: '/demo/ritmo.webp', coverAlt: '', videoUrl: '', featured: false, sortOrder: 0, status: 'published' as const });

beforeAll(async () => {
  const legacy = new Database(join(directory, 'frame.sqlite'));
  legacy.exec(`CREATE TABLE installation (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, schemaVersion INTEGER NOT NULL);
    CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, description TEXT NOT NULL, categoryId TEXT, coverMediaId TEXT, coverUrl TEXT NOT NULL, coverAlt TEXT NOT NULL, videoUrl TEXT NOT NULL, featured INTEGER NOT NULL, sortOrder INTEGER NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    PRAGMA user_version = 1;`);
  legacy.prepare('INSERT INTO installation VALUES (1,?,1)').run(installationId);
  legacy.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(legacyId, 'legacy-work', 'Preserved title', '', '', null, null, '/demo/ritmo.webp', '', '', 0, 0, 'published', '2026-10-13', '2026-10-13');
  legacy.close();
  storage = await import('../src/lib/server/db');
  projects = await import('../src/lib/server/projects');
  owner = await (await import('../src/lib/server/auth')).provisionOwner('source@example.test', 'StrongTestPassword123!');
}, 60_000);
afterAll(() => { storage?.sqlite.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); });

it('migrates a schema1 project with empty reference preserving installation and content', () => {
  expect(projects.getPublicProject('legacy-work')).toMatchObject({ id: legacyId, title: 'Preserved title', sourceUrl: '' });
  expect(storage.sqlite.pragma('user_version', { simple: true })).toBe(3);
  expect(storage.sqlite.prepare('SELECT uuid,schemaVersion FROM installation').get()).toEqual({ uuid: installationId, schemaVersion: 3 });
  storage.migrate();
  expect(projects.getPublicProjects()).toHaveLength(1);
});
it('persists source links independently from the empty embedded-video field and allows clearing', () => {
  const p = projects.saveProject({ ...input('source-work'), sourceUrl: '  https://x.com/example/status/123?ref=portfolio  ' }, owner);
  const db = new Database(join(directory, 'frame.sqlite'), { readonly: true });
  try { expect(db.prepare('SELECT sourceUrl,videoUrl FROM projects WHERE id=?').get(p.id)).toEqual({ sourceUrl: 'https://x.com/example/status/123?ref=portfolio', videoUrl: '' }); }
  finally { db.close(); }
  expect(projects.getPublicProject(p.slug)?.sourceUrl).toBe('https://x.com/example/status/123?ref=portfolio');
  projects.saveProject({ ...p, sourceUrl: '' }, owner);
  expect(projects.getProject(p.id, owner)?.sourceUrl).toBe('');
});
it('defaults omitted sourceUrl to empty for existing callers', () => {
  expect(projects.saveProject(input('without-source'), owner).sourceUrl).toBe('');
});
it.each(['http://x.com/example/status/123', '//x.com/example/status/123', 'javascript:alert(1)', 'https://owner:secret@x.com/example', 'https://x.com\\@evil.test/post', 'https://x.com/post\nnext', 'not-a-url', 'https://'])('rejects unsafe original publication %s without persisting', (sourceUrl) => {
  expect(() => projects.saveProject({ ...input('invalid-source'), sourceUrl }, owner)).toThrow();
  expect(projects.getPublicProject('invalid-source')).toBeNull();
});
it('does not accept X posts in the embedded-video field', () => {
  expect(() => projects.saveProject({ ...input('x-embed'), videoUrl: 'https://x.com/example/status/123', sourceUrl: 'https://x.com/example/status/123' }, owner)).toThrow();
});
it('parses the optional original publication from the actual owner form', async () => {
  const { parseProjectForm } = await import('../src/lib/project-form.server');
  const form = new FormData(); form.set('sourceUrl', 'https://x.com/example/status/123');
  expect(parseProjectForm(form).sourceUrl).toBe('https://x.com/example/status/123');
  form.delete('sourceUrl'); expect(parseProjectForm(form).sourceUrl).toBe('');
});
