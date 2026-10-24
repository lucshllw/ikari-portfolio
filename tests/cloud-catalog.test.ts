import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const state = vi.hoisted(() => ({ results: [] as { data: unknown; error: unknown }[], queries: [] as { table: string; ops: unknown[][] }[], downloads: [] as string[], download: null as Blob | null, signed: [] as unknown[][], uploads: [] as { key: string; data: Uint8Array; options: unknown }[], removed: [] as string[] }));
vi.mock('../src/lib/server/cloud/client', () => ({ getCloudServiceClient: () => ({
  from: (table: string) => {
    const record = { table, ops: [] as unknown[][] }; state.queries.push(record);
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'upsert', 'delete']) query[method] = (...args: unknown[]) => { record.ops.push([method, ...args]); return query; };
    query.then = (resolve: (value: unknown) => void) => resolve(state.results.shift() || { data: null, error: new Error('Unexpected request') });
    return query;
  },
  storage: { from: (bucket: string) => ({
    download: async (key: string) => { state.downloads.push(`${bucket}/${key}`); return { data: state.download, error: null }; },
    createSignedUploadUrl: async (path: string, options: unknown) => { state.signed.push([bucket, path, options]); return { data: { signedUrl: 'https://storage.test/upload-token', token: 'test-token', path }, error: null }; },
    createSignedUrl: async (path: string, seconds: number) => { state.signed.push([bucket, path, seconds]); return { data: { signedUrl: 'https://storage.test/read-token' }, error: null }; },
    upload: async (key: string, data: Uint8Array, options: unknown) => { state.uploads.push({ key, data, options }); return { data: { path: key }, error: null }; },
    remove: async (paths: string[]) => { state.removed.push(...paths); return { data: [], error: null }; }
  }) }
}) }));
import * as cloud from '../src/lib/server/cloud/catalog';
import { exportCloudCatalog } from '../scripts/export-cloud-catalog';
const actor = '10000000-0000-4000-8000-000000000001';
const projectId = '10000000-0000-4000-8000-000000000002';
const mediaId = '10000000-0000-4000-8000-000000000003';
const categoryId = '10000000-0000-4000-8000-000000000004';
const input = { slug: 'commission', title: 'Commission', summary: '', description: '', categoryId: null, coverMediaId: null, coverUrl: '', coverAlt: '', videoUrl: '', sourceUrl: '', featured: false, sortOrder: 0, status: 'published' as const };
const result = (data: unknown, error: unknown = null) => state.results.push({ data, error });
beforeEach(() => { state.results.length = 0; state.queries.length = 0; state.downloads.length = 0; state.download = null; state.signed.length = 0; state.uploads.length = 0; state.removed.length = 0; });

describe('cloud catalog authorization and visibility', () => {
  it.each([
    () => cloud.listProjects(actor), () => cloud.getProject(projectId, actor), () => cloud.saveProject(input, actor),
    () => cloud.deleteProject(projectId, actor), () => cloud.moveProject(projectId, 1, actor),
    () => cloud.saveCategory({ slug: 'test', name: 'Test', sortOrder: 0 }, actor), () => cloud.deleteCategory(categoryId, actor),
    () => cloud.saveSettings({} as never, actor), () => cloud.listMedia(actor),
    () => cloud.uploadImage(new Uint8Array(), { filename: 'x.png', mime: 'image/png', alt: '' }, actor), () => cloud.deleteMedia(mediaId, actor),
    () => cloud.getMediaFile(mediaId, actor), () => cloud.getExcerptFile(projectId, actor),
    () => cloud.beginImageUpload({ filename: 'test.png', mime: 'image/png', alt: '' }, actor),
    () => cloud.completeImageUpload(mediaId, { filename: 'test.png', mime: 'image/png', alt: '' }, actor)
  ])('checks the editor allowlist before accessing private catalog data', async (operation) => {
    result(null);
    await expect(operation()).rejects.toThrow('Acesso restrito');
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]).toMatchObject({ table: 'ikari_editors', ops: [['select', 'user_id'], ['eq', 'user_id', actor], ['maybeSingle']] });
    expect(state.downloads).toHaveLength(0);
  });
  it('rejects invalid actor identifiers without issuing service requests', async () => {
    await expect(cloud.listProjects('not-an-owner')).rejects.toThrow('Acesso restrito');
    expect(state.queries).toHaveLength(0);
  });
  it('fails closed when the allowlist query fails without leaking diagnostics', async () => {
    result(null, new Error('secret service key diagnostics'));
    await expect(cloud.listProjects(actor)).rejects.toThrow('Não foi possível');
    expect(state.queries).toHaveLength(1);
  });
  it('always filters public projects and individual slugs by published status', async () => {
    result([]); await cloud.getPublicProjects(); result(null); await cloud.getPublicProject('draft');
    for (const query of state.queries) expect(query.ops).toContainEqual(['eq', 'status', 'published']);
  });
  it('combines category filtering with published visibility', async () => {
    result({ id: categoryId }); result([]);
    expect(await cloud.getPublicProjects('animation')).toEqual([]);
    const projects = state.queries.find(query => query.table === 'ikari_projects')!;
    expect(projects.ops).toContainEqual(['eq', 'categoryId', categoryId]);
    expect(projects.ops).toContainEqual(['eq', 'status', 'published']);
  });
  it('does not download orphaned or draft-only media', async () => {
    result([]); expect(await cloud.getMediaFile(mediaId)).toBeNull();
    expect(state.queries[0].ops).toContainEqual(['eq', 'status', 'published']);
    expect(state.downloads).toHaveLength(0);
  });
  it('validates storage path and checksum before returning public media', async () => {
    const bytes = Buffer.from('verified-image'), checksum = createHash('sha256').update(bytes).digest('hex');
    const row = { id: mediaId, filename: `${mediaId}.webp`, storageKey: `media/${mediaId}.webp`, originalKey: null, size: bytes.length, checksum, alt: '', mime: 'image/webp', width: 1, height: 1, createdAt: '2026-10-15T00:00:00.000Z' };
    result([{ id: projectId }]); result(row); state.download = new Blob([bytes]);
    expect(await cloud.getMediaFile(mediaId)).toMatchObject({ media: { id: mediaId, url: `/media/${mediaId}` }, bytes });
    result([{ id: projectId }]); result({ ...row, storageKey: '../private' });
    expect(await cloud.getMediaFile(mediaId)).toBeNull(); expect(state.downloads).toHaveLength(1);
    result([{ id: projectId }]); result({ ...row, checksum: '0'.repeat(64) });
    expect(await cloud.getMediaFile(mediaId)).toBeNull();
  });
  it('does not accept unsafe cover or publication URLs', async () => {
    result({ user_id: actor });
    await expect(cloud.saveProject({ ...input, sourceUrl: 'https://a:b@example.test' }, actor)).rejects.toThrow();
    result({ user_id: actor });
    await expect(cloud.saveProject({ ...input, coverUrl: 'https://example.test/image.webp' }, actor)).rejects.toThrow('Selecione uma imagem');
  });
  it('rejects oversized and misleading image input before storage', async () => {
    result({ user_id: actor });
    await expect(cloud.uploadImage(new Uint8Array(cloud.MAX_IMAGE_BYTES + 1), { filename: 'image.jpg', mime: 'image/jpeg', alt: '' }, actor)).rejects.toThrow('12 MiB');
    result({ user_id: actor });
    await expect(cloud.uploadImage(new Uint8Array([1]), { filename: '../private.png', mime: 'image/png', alt: '' }, actor)).rejects.toThrow('Nome de arquivo');
  });
  it('fails explicitly when cloud settings have not been imported', async () => {
    result(null); await expect(cloud.getPublicSettings()).rejects.toThrow('ainda não importada');
  });
  it('issues signed staging uploads only below the verified actor prefix', async () => {
    result({ user_id: actor });
    const upload = await cloud.beginImageUpload({ filename: 'test.png', mime: 'image/png', alt: '' }, actor);
    expect(upload.path).toBe(`${actor}/${upload.uploadId}`);
    expect(state.signed).toEqual([['ikari-uploads', upload.path, { upsert: false }]]);
    expect(state.uploads).toHaveLength(0);
  });
  it('finalizes signed uploads with actual decoding, WebP normalization and cleanup', async () => {
    const original = await sharp({ create: { width: 10, height: 5, channels: 3, background: '#111111' } }).png().toBuffer();
    state.download = new Blob([original]); result({ user_id: actor }); result({ user_id: actor }); result(null);
    const media = await cloud.completeImageUpload(mediaId, { filename: 'camera.png', mime: 'image/png', alt: 'Credit' }, actor);
    expect(media).toMatchObject({ width: 10, height: 5, mime: 'image/webp', alt: 'Credit' });
    expect(state.downloads).toEqual([`ikari-uploads/${actor}/${mediaId}`]);
    expect(state.uploads).toHaveLength(2);
    expect(state.uploads[1].key).toBe(`media/${media.id}.webp`);
    expect((await sharp(state.uploads[1].data).metadata()).format).toBe('webp');
    expect(state.removed).toContain(`${actor}/${mediaId}`);
    const stored = state.queries.find(q => q.table === 'ikari_media')?.ops.find(op => op[0] === 'insert')?.[1] as { checksum: string };
    expect(stored.checksum).toBe(createHash('sha256').update(state.uploads[1].data).digest('hex'));
  });
  it('removes rejected staging bytes and creates no public media row', async () => {
    state.download = new Blob([Buffer.from('not a PNG')]); result({ user_id: actor }); result({ user_id: actor });
    await expect(cloud.completeImageUpload(mediaId, { filename: 'test.png', mime: 'image/png', alt: '' }, actor)).rejects.toThrow();
    expect(state.removed).toContain(`${actor}/${mediaId}`); expect(state.uploads).toHaveLength(0);
    expect(state.queries.every(q => q.table === 'ikari_editors')).toBe(true);
  });
  it('serves clips with a 60-second signed URL after verifying persisted public visibility', async () => {
    const sourceUrl = 'https://x.com/editor/status/123';
    const entry = { postId: '123', sourceUrl, filename: '123.mp4', sha256: 'a'.repeat(64), size: 10, duration: 1, width: 1, height: 1 };
    result({ ...input, id: projectId, sourceUrl }); result({ projectId, entry, storageKey: 'excerpts/123.mp4' });
    const file = await cloud.getExcerptFile(projectId);
    expect(file).toMatchObject({ excerpt: { src: `/trechos/${projectId}` }, signedUrl: 'https://storage.test/read-token' });
    expect(state.queries[0].ops).toContainEqual(['eq', 'status', 'published']);
    expect(state.signed).toEqual([['ikari-media', 'excerpts/123.mp4', 60]]);
    expect(state.downloads).toHaveLength(0);
  });
});

const temp = mkdtempSync(join(tmpdir(), 'ikari-cloud-export-'));
afterAll(() => rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
it('exports only the public snapshot, verified assets and allowlisted settings without modifying SQLite', async () => {
  const data = join(temp, 'data'), output = join(temp, 'output');
  mkdirSync(join(data, 'media'), { recursive: true }); mkdirSync(join(data, 'excerpts'));
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#111111' } }).webp().toBuffer();
  const checksum = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(join(data, 'media', `${mediaId}.webp`), bytes);
  const clip = Buffer.from('test-video-bytes'), clipChecksum = createHash('sha256').update(clip).digest('hex'), sourceUrl = 'https://x.com/editor/status/123';
  writeFileSync(join(data, 'excerpts', '123.mp4'), clip);
  writeFileSync(join(data, 'excerpts', 'manifest.json'), JSON.stringify({ version: 1, entries: [{ postId: '123', sourceUrl, filename: '123.mp4', sha256: clipChecksum, size: clip.length, duration: 1, width: 1, height: 1, artist: 'Author' }] }));
  const db = new Database(join(data, 'frame.sqlite'));
  db.exec('CREATE TABLE categories (id TEXT,name TEXT,slug TEXT,sortOrder INTEGER); CREATE TABLE site_settings (id INTEGER,value TEXT); CREATE TABLE user (password TEXT); CREATE TABLE inquiries (brief TEXT);');
  db.exec('CREATE TABLE projects (id TEXT,slug TEXT,title TEXT,summary TEXT,description TEXT,categoryId TEXT,coverMediaId TEXT,coverUrl TEXT,coverAlt TEXT,videoUrl TEXT,sourceUrl TEXT,featured INTEGER,sortOrder INTEGER,status TEXT,createdAt TEXT,updatedAt TEXT);');
  db.exec('CREATE TABLE media (id TEXT,filename TEXT,mime TEXT,size INTEGER,width INTEGER,height INTEGER,alt TEXT,createdAt TEXT,checksum TEXT);');
  db.prepare('INSERT INTO categories VALUES (?,?,?,0)').run(categoryId, 'Animation', 'animation');
  db.prepare('INSERT INTO site_settings VALUES (1,?)').run(JSON.stringify({ brandName: 'Ikari', headline: 'Headline', subheadline: '', about: '', email: '', instagramUrl: '', accentColor: '#111111', servicesText: '', availability: '', privateField: 'PRIVATE_CANARY_SETTINGS' }));
  db.prepare('INSERT INTO user VALUES (?)').run('PRIVATE_CANARY_AUTH'); db.prepare('INSERT INTO inquiries VALUES (?)').run('PRIVATE_CANARY_INQUIRY');
  const projectInsert = db.prepare('INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  projectInsert.run(projectId, 'public', 'Public title', '', '', categoryId, mediaId, `/media/${mediaId}`, 'Credit author', '', sourceUrl, 1, 0, 'published', '2026-10-15', '2026-10-15');
  projectInsert.run(actor, 'draft', 'PRIVATE_CANARY_DRAFT', '', '', null, null, '', '', '', '', 0, 1, 'draft', '2026-10-15', '2026-10-15');
  db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?,?,?)').run(mediaId, `${mediaId}.webp`, 'image/webp', bytes.length, 1, 1, 'Credit author', '2026-10-15', checksum);
  db.close();
  const before = readFileSync(join(data, 'frame.sqlite'));
  expect(exportCloudCatalog(data, output)).toEqual({ projects: 1, categories: 1, media: 1, excerpts: 1, assets: 2 });
  const json = readFileSync(join(output, 'catalog.json'), 'utf8'), bundle = JSON.parse(json);
  expect(json).not.toContain('PRIVATE_CANARY'); expect(json).not.toContain(data); expect(json).not.toContain('password'); expect(json).not.toContain('inquiries');
  expect(bundle.projects[0]).toMatchObject({ id: projectId, coverAlt: 'Credit author', featured: true });
  expect(bundle.excerpts[0].entry.artist).toBe('Author'); expect(bundle.media[0].checksum).toBe(checksum);
  expect(readFileSync(join(output, `assets/media/${mediaId}.webp`))).toEqual(bytes);
  expect(readFileSync(join(data, 'frame.sqlite'))).toEqual(before);
  expect(() => exportCloudCatalog(data, output)).toThrow('já existe');
  expect(() => exportCloudCatalog(data, join(process.cwd(), 'private-export'))).toThrow('fora do repositório');
});
