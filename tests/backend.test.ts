import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'frame-domain-'));
process.env.DATA_DIR = directory;
process.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-thirty-two-characters';
process.env.ORIGIN = 'http://localhost:4173';
let api: typeof import('../src/lib/server/projects');
let auth: typeof import('../src/lib/server/auth');
let inquiries: typeof import('../src/lib/server/inquiries');
let media: typeof import('../src/lib/server/media');
let settings: typeof import('../src/lib/server/settings');
let storage: typeof import('../src/lib/server/db/index');
let owner: string;
beforeAll(async () => {
  api = await import('../src/lib/server/projects');
  auth = await import('../src/lib/server/auth');
  inquiries = await import('../src/lib/server/inquiries');
  media = await import('../src/lib/server/media');
  settings = await import('../src/lib/server/settings');
  storage = await import('../src/lib/server/db/index');
  owner = await auth.provisionOwner('owner@example.test', 'StrongTestPassword123!');
}, 60_000);
afterAll(() => { storage?.sqlite.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });
const project = (slug = 'example') => ({ slug, title: 'Example editorial', summary: 'A fictional example', description: 'Plain text', categoryId: null, coverMediaId: null, coverUrl: '/demo/01.webp', coverAlt: 'Abstract', videoUrl: '', featured: false, sortOrder: 0, status: 'draft' as const });

describe('owner boundary', () => {
  it('anonymous cannot mutate', () => expect(() => api.saveProject(project(), 'unknown')).toThrow());
  it('expired session cannot read inquiries', () => expect(() => auth.requireOwner({ user: { id: owner }, session: { userId: owner, expiresAt: new Date(0) } } as App.Locals)).toThrow());
  it('bootstrap cannot add second proprietor', async () => { await expect(auth.provisionOwner('second@example.test', 'StrongTestPassword123!')).rejects.toThrow(); });
  it('public HTTP signup is disabled', async () => {
    const response = await auth.auth.handler(new Request('http://localhost:4173/api/auth/sign-up/email', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4173' }, body: JSON.stringify({ name: 'Visitor', email: 'visitor@example.test', password: 'StrongTestPassword123!' }) }));
    expect(response.ok).toBe(false);
  });
  it('login then logout revokes the real stored session', async () => {
    const response = await auth.auth.handler(new Request('http://localhost:4173/api/auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4173' }, body: JSON.stringify({ email: 'owner@example.test', password: 'StrongTestPassword123!' }) }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    expect((await auth.auth.api.getSession({ headers: new Headers({ cookie }) }))?.user.id).toBe(owner);
    await auth.auth.handler(new Request('http://localhost:4173/api/auth/sign-out', { method: 'POST', headers: { cookie, origin: 'http://localhost:4173', 'content-type': 'application/json' }, body: '{}' }));
    expect(await auth.auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });
});
describe('projects and settings', () => {
  it('draft is not public even by slug; publish then unpublish', () => {
    const p = api.saveProject(project(), owner);
    expect(api.getPublicProject(p.slug)).toBeNull();
    api.saveProject({ ...p, status: 'published' }, owner);
    expect(api.getPublicProject(p.slug)?.title).toBe('Example editorial');
    api.saveProject({ ...p, status: 'draft' }, owner);
    expect(api.getPublicProject(p.slug)).toBeNull();
  });
  it('duplicate slug is rejected and category references cannot break projects', () => {
    expect(() => api.saveProject(project(), owner)).toThrow();
    const category = api.saveCategory({ name: 'Motion', slug: 'motion', sortOrder: 0 }, owner);
    api.saveProject({ ...project('categorized'), categoryId: category.id }, owner);
    expect(() => api.deleteCategory(category.id, owner)).toThrow();
  });
  it('identity and projects persist in a separate connection', async () => {
    settings.saveSettings({ ...settings.getPublicSettings(), brandName: 'Studio Example' }, owner);
    const { default: Database } = await import('better-sqlite3');
    const connection = new Database(join(directory, 'frame.sqlite'));
    expect(connection.prepare('select count(*) as n from projects').get()).toMatchObject({ n: 2 });
    expect((connection.prepare('select value from site_settings where id = 1').get() as { value: string }).value).toContain('Studio Example');
    connection.close();
  });
  it('demo seed adds four fictional works once and preserves owner changes', async () => {
    const { seedDemo } = await import('../src/lib/server/seed');
    expect(seedDemo(owner)).toBe(4);
    const demo = api.getPublicProject('intervalo-demo')!;
    api.saveProject({ ...demo, slug: 'personalized-owner', title: 'Personalized by owner' }, owner);
    expect(seedDemo(owner)).toBe(0);
    expect(api.getPublicProject('personalized-owner')?.title).toBe('Personalized by owner');
  });
});
describe('inquiries', () => {
  it('valid request persists and replay is idempotent', () => {
    const a = inquiries.createInquiry({ name: 'Example', email: 'example@example.test', service: 'Motion', brief: 'A fictional briefing' }, '12345678-1234-4321-8123-123456789abc');
    const b = inquiries.createInquiry({ name: 'Example', email: 'example@example.test', service: 'Motion', brief: 'A fictional briefing' }, '12345678-1234-4321-8123-123456789abc');
    expect(a.id).toBe(b.id);
    expect(inquiries.listInquiries(owner)).toHaveLength(1);
    expect(() => inquiries.listInquiries('anonymous')).toThrow();
  });
  it('invalid request is never saved', () => {
    expect(() => inquiries.createInquiry({ name: '', email: 'invalid', service: '', brief: '' }, 'invalid')).toThrow();
    expect(inquiries.listInquiries(owner)).toHaveLength(1);
  });
});
describe('media', () => {
  it('validates raster bytes when a browser supplies no useful MIME hint', async () => {
    const { default: sharp } = await import('sharp');
    const bytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#344ccd' } }).webp().toBuffer();
    for (const mime of ['', 'application/octet-stream']) {
      const stored = await media.uploadImage(bytes, { filename: 'browser.webp', mime, alt: 'Imagem de teste' }, owner);
      expect(stored.mime).toBe('image/webp');
      media.deleteMedia(stored.id, owner);
    }
    await expect(media.uploadImage(bytes, { filename: 'mismatch.jpg', mime: 'image/jpeg', alt: '' }, owner)).rejects.toThrow();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="blue"/></svg>');
    await expect(media.uploadImage(svg, { filename: 'unsafe.webp', mime: 'application/octet-stream', alt: '' }, owner)).rejects.toThrow();
    await expect(media.uploadImage(new Uint8Array([1, 2, 3]), { filename: 'fake.webp', mime: '', alt: '' }, owner)).rejects.toThrow();
  });
  it('rejects hostile embeds', () => {
    for (const url of ['javascript:alert(1)', 'https://youtube.com.bad.test/watch?v=abcdefghijk', 'https://u:p@youtube.com/watch?v=abcdefghijk', 'https://youtube.com:8443/watch?v=abcdefghijk']) expect(() => media.parseVideoUrl(url)).toThrow();
    expect(media.parseVideoUrl('https://www.youtube.com/watch?v=abcdefghijk')?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/abcdefghijk');
  });
  it('rejects fake image, oversized image and path traversal', async () => {
    await expect(media.uploadImage(new Uint8Array([1, 2, 3]), { filename: 'test.png', mime: 'image/png', alt: '' }, owner)).rejects.toThrow();
    await expect(media.uploadImage(new Uint8Array(12 * 1024 * 1024 + 1), { filename: 'test.png', mime: 'image/png', alt: '' }, owner)).rejects.toThrow();
    await expect(media.uploadImage(new Uint8Array([1, 2, 3]), { filename: '../test.png', mime: 'image/png', alt: '' }, owner)).rejects.toThrow();
    expect(media.listMedia(owner)).toHaveLength(0);
  });
  it('private media is unavailable until associated project is published', async () => {
    const { default: sharp } = await import('sharp');
    const bytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#fa9911' } }).png().toBuffer();
    const m = await media.uploadImage(bytes, { filename: 'example.png', mime: 'image/png', alt: 'Orange' }, owner);
    expect(media.getMediaFile(m.id)).toBeNull();
    const p = api.saveProject({ ...project('with-image'), coverMediaId: m.id, coverUrl: m.url }, owner);
    expect(media.getMediaFile(m.id)).toBeNull();
    api.saveProject({ ...p, status: 'published' }, owner);
    expect(media.getMediaFile(m.id)?.media.mime).toBe('image/webp');
    expect(() => media.deleteMedia(m.id, owner)).toThrow();
  });
});
