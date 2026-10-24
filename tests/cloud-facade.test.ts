import { afterEach, expect, it, vi } from 'vitest';

// These modules throw on import, proving cloud reads cannot initialize local
// SQLite or local auth-secret/media directories through an accidental import.
vi.mock('../src/lib/server/projects', () => { throw new Error('SQLite projects imported in cloud'); });
vi.mock('../src/lib/server/settings', () => { throw new Error('SQLite settings imported in cloud'); });
vi.mock('../src/lib/server/media', () => { throw new Error('Local media imported in cloud'); });
vi.mock('../src/lib/server/db', () => { throw new Error('SQLite imported in cloud'); });
vi.mock('../src/lib/server/config', () => { throw new Error('Local provisioning imported in cloud'); });
vi.mock('../src/lib/server/cloud/catalog', () => ({
  getPublicProjects: async () => [{ id: 'public-only' }],
  getPublicSettings: async () => ({ brandName: 'Ikari' }),
  getMediaFile: async () => ({ media: { mime: 'image/webp' }, bytes: Buffer.from('image') })
}));
afterEach(() => vi.unstubAllEnvs());
it('serves cloud catalog, settings, media and stable accent without loading local persistence', async () => {
  vi.stubEnv('FRAME_STORAGE', 'supabase');
  const catalog = await import('../src/lib/server/catalog');
  expect(await catalog.getPublicProjects()).toEqual([{ id: 'public-only' }]);
  expect(await catalog.getPublicSettings()).toEqual({ brandName: 'Ikari' });
  expect(await catalog.getMediaFile('id')).toMatchObject({ bytes: Buffer.from('image') });
  expect(await (await import('../src/lib/server/project-presentation')).projectAccent('/media/10000000-0000-4000-8000-000000000003')).toBe('#b8ff01');
});
