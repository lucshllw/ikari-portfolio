import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, checkRestore } from '../scripts/operations';
import type { Project } from '../src/lib/domain/types';

const root = mkdtempSync(join(tmpdir(), 'frame-excerpts-test-'));
const directory = join(root, 'live');
process.env.DATA_DIR = directory;
process.env.BETTER_AUTH_SECRET = 'isolated-excerpts-test-secret-more-than-thirty-two-characters';
let projects: typeof import('../src/lib/server/projects');
let auth: typeof import('../src/lib/server/auth');
let storage: typeof import('../src/lib/server/db');
let excerpts: typeof import('../src/lib/server/excerpts');
let route: typeof import('../src/routes/trechos/[id]/+server');
let owner: string;
let project: Project;
const bytes = Buffer.from('0123456789');
const entry = {
  postId: '2106536487978209566', sourceUrl: 'https://x.com/ikarikjkk/status/2106536487978209566',
  filename: '2106536487978209566.mp4', sha256: createHash('sha256').update(bytes).digest('hex'),
  size: bytes.length, duration: 2.5, width: 1920, height: 1080, artist: 'Example Artist', track: 'Example Track',
  spotifyUrl: 'https://open.spotify.com/track/0123456789', youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', coverProvider: 'Spotify'
};
function manifest(value: unknown = { version: 1, entries: [entry] }) {
  writeFileSync(join(directory, 'excerpts', 'manifest.json'), JSON.stringify(value));
}
async function request(method = 'GET', range?: string, locals: App.Locals = { user: null, session: null }, id = project.id) {
  return route[method === 'HEAD' ? 'HEAD' : 'GET']({
    params: { id }, locals, request: new Request(`http://localhost/trechos/${id}`, { method, headers: range === undefined ? {} : { range } })
  } as never) as Response;
}
beforeAll(async () => {
  projects = await import('../src/lib/server/projects'); auth = await import('../src/lib/server/auth');
  storage = await import('../src/lib/server/db'); excerpts = await import('../src/lib/server/excerpts');
  route = await import('../src/routes/trechos/[id]/+server');
  owner = await auth.provisionOwner('excerpt-owner@example.test', 'ExcerptTestPassword123!');
}, 60_000);
beforeEach(() => {
  const folder = join(directory, 'excerpts');
  rmSync(folder, { recursive: true, force: true }); mkdirSync(folder);
  manifest(); writeFileSync(join(folder, entry.filename), bytes);
  project = projects.saveProject({
    slug: `excerpt-${randomUUID()}`, title: 'Excerpt test', summary: '', description: '', categoryId: null,
    coverMediaId: null, coverUrl: '', coverAlt: '', sourceUrl: entry.sourceUrl, videoUrl: '',
    featured: false, sortOrder: 0, status: 'published'
  }, owner);
});
afterAll(() => { storage?.sqlite.close(); rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe('local excerpt identity and files', () => {
  it('returns safe metadata only for the exact original source and existing file', async () => {
    expect(excerpts.getProjectExcerpt(project)).toEqual({ ...entry, src: `/trechos/${project.id}` });
    expect(excerpts.getProjectExcerpt({ ...project, sourceUrl: entry.sourceUrl + '?s=20' })).toBeNull();
    expect(excerpts.getProjectExcerpt({ ...project, sourceUrl: 'https://x.com/other/status/2106536487978209566' })).toBeNull();
    expect(excerpts.getProjectExcerpt({ ...project, id: '../escape' })).toBeNull();
    rmSync(join(directory, 'excerpts', entry.filename));
    expect(excerpts.getProjectExcerpt(project)).toBeNull(); expect((await request()).status).toBe(404);
  });
  it('missing and malformed manifests fail gracefully', async () => {
    rmSync(join(directory, 'excerpts', 'manifest.json'));
    expect(excerpts.getProjectExcerpt(project)).toBeNull(); expect((await request()).status).toBe(404);
    writeFileSync(join(directory, 'excerpts', 'manifest.json'), '{broken');
    expect(excerpts.getProjectExcerpt(project)).toBeNull(); expect((await request('HEAD')).status).toBe(404);
  });
  it.each(['../outside.mp4', 'C:/outside.mp4', 'other.mp4', '2106536487978209566.mp4/../outside', '2106536487978209566.mp4\\x'])('rejects unsafe manifest filename %s', async (filename) => {
    manifest({ version: 1, entries: [{ ...entry, filename }] });
    expect(excerpts.getProjectExcerpt(project)).toBeNull(); expect((await request()).status).toBe(404);
  });
  it('rejects mismatched post identity, duplicate entries, hostile URLs and changed file size', () => {
    for (const value of [
      { version: 1, entries: [{ ...entry, postId: '123' }] }, { version: 1, entries: [entry, entry] },
      { version: 1, entries: [{ ...entry, sourceUrl: 'https://x.com.bad.test/ikari/status/2106536487978209566' }] },
      { version: 1, entries: [{ ...entry, spotifyUrl: 'javascript:alert(1)' }] }
    ]) { manifest(value); expect(excerpts.getProjectExcerpt(project)).toBeNull(); }
    manifest(); writeFileSync(join(directory, 'excerpts', entry.filename), 'changed');
    expect(excerpts.getProjectExcerpt(project)).toBeNull();
  });
  it('refuses a directory junction pointing outside DATA_DIR', async () => {
    const outside = join(root, 'outside'); mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'manifest.json'), JSON.stringify({ version: 1, entries: [entry] }));
    writeFileSync(join(outside, entry.filename), bytes);
    rmSync(join(directory, 'excerpts'), { recursive: true });
    symlinkSync(outside, join(directory, 'excerpts'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(excerpts.getProjectExcerpt(project)).toBeNull(); expect((await request()).status).toBe(404);
    expect(readFileSync(join(outside, entry.filename))).toEqual(bytes);
  });
});

describe('video HTTP responses', () => {
  it('streams the full published clip with video/security headers', async () => {
    const result = (await request()); expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('video/mp4'); expect(result.headers.get('accept-ranges')).toBe('bytes');
    expect(result.headers.get('content-length')).toBe('10'); expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff'); expect(result.headers.has('content-range')).toBe(false);
    expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes);
  });
  it.each([
    ['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-50', '89', 'bytes 8-9/10'],
    ['bytes=-50', '0123456789', 'bytes 0-9/10'], ['bytes=0-0', '0', 'bytes 0-0/10']
  ])('streams a single range %s', async (range, expected, contentRange) => {
    const result = (await request('GET', range)); expect(result.status).toBe(206);
    expect(result.headers.get('content-range')).toBe(contentRange);
    expect(result.headers.get('content-length')).toBe(String(expected.length)); expect(await result.text()).toBe(expected);
  });
  it.each(['', 'bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'items=0-2', 'bytes=9007199254740992-', 'bytes=0-1x'])('rejects invalid or multiple ranges %s', async (range) => {
    const result = (await request('GET', range)); expect(result.status).toBe(416);
    expect(result.headers.get('content-range')).toBe('bytes */10'); expect(await result.text()).toBe('');
  });
  it('HEAD returns the same lengths and ranges without a response body', async () => {
    const full = (await request('HEAD')); expect(full.status).toBe(200); expect(full.headers.get('content-length')).toBe('10'); expect(full.body).toBeNull();
    const partial = (await request('HEAD', 'bytes=2-4')); expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe('bytes 2-4/10'); expect(partial.headers.get('content-length')).toBe('3'); expect(partial.body).toBeNull();
    expect((await request('HEAD', 'bytes=100-')).status).toBe(416);
  });
  it('hides draft clips publicly and allows only the current stored owner session', async () => {
    project = projects.saveProject({ ...project, status: 'draft' }, owner);
    expect((await request()).status).toBe(404); expect((await request('HEAD')).status).toBe(404);
    const id = randomUUID(), expiresAt = new Date(Date.now() + 60_000), timestamp = Date.now();
    storage.sqlite.prepare('INSERT INTO session (id,expiresAt,token,createdAt,updatedAt,userId) VALUES (?,?,?,?,?,?)').run(id, +expiresAt, randomUUID(), timestamp, timestamp, owner);
    const locals = { user: { id: owner }, session: { id, userId: owner, expiresAt } } as App.Locals;
    const allowed = (await request('GET', 'bytes=1-2', locals)); expect(allowed.status).toBe(206); expect(await allowed.text()).toBe('12');
    expect((await request('GET', undefined, { ...locals, session: { ...locals.session!, expiresAt: new Date(0) } })).status).toBe(404);
    storage.sqlite.prepare('DELETE FROM session WHERE id=?').run(id);
    expect((await request('GET', undefined, locals)).status).toBe(404);
    expect((await request('GET', undefined, { user: { id: owner }, session: null } as App.Locals)).status).toBe(404);
  });
  it('unknown and non-UUID project IDs return 404 before file lookup', async () => {
    expect((await request('GET', undefined, undefined, randomUUID())).status).toBe(404);
    expect((await request('GET', undefined, undefined, '../outside')).status).toBe(404);
  });
});

describe('excerpt backup consistency', () => {
  it('backs up and restores the manifest, hash and complete clip without changing database schema', async () => {
    const backup = await createBackup({ dataDir: directory, destination: join(root, randomUUID()), serverStopped: true });
    const packageManifest = JSON.parse(readFileSync(join(backup.directory, 'manifest.json'), 'utf8'));
    expect(packageManifest.schemaVersion).toBe(3);
    expect(packageManifest.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'excerpts/manifest.json' }),
      { path: `excerpts/${entry.filename}`, size: entry.size, sha256: entry.sha256 }
    ]));
    const restored = await checkRestore(backup.directory, { dataDir: directory, destination: join(root, randomUUID()) });
    expect(readFileSync(join(restored.directory, 'excerpts', entry.filename))).toEqual(bytes);
    expect(JSON.parse(readFileSync(join(restored.directory, 'excerpts', 'manifest.json'), 'utf8'))).toEqual({ version: 1, entries: [entry] });
  });
  it('refuses a mismatched clip hash and never promotes a partial backup', async () => {
    manifest({ version: 1, entries: [{ ...entry, sha256: 'a'.repeat(64) }] });
    const destination = join(root, randomUUID());
    await expect(createBackup({ dataDir: directory, destination, serverStopped: true })).rejects.toThrow(/trecho|integridade/i);
    expect(existsSync(destination)).toBe(false);
  });
  it('refuses a backup whose outer hashes pass but excerpt references omit a clip', async () => {
    const backup = await createBackup({ dataDir: directory, destination: join(root, randomUUID()), serverStopped: true });
    const path = join(backup.directory, 'manifest.json'), value = JSON.parse(readFileSync(path, 'utf8'));
    value.files = value.files.filter((file: { path: string }) => file.path !== `excerpts/${entry.filename}`);
    rmSync(join(backup.directory, 'excerpts', entry.filename)); writeFileSync(path, JSON.stringify(value));
    const destination = join(root, randomUUID());
    await expect(checkRestore(backup.directory, { dataDir: directory, destination })).rejects.toThrow(/trecho/i);
    expect(existsSync(destination)).toBe(false);
  });
});
