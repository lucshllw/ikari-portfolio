import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importCloudCatalog, MAX_CLOUD_ASSET_BYTES } from '../scripts/import-cloud-catalog';

const temp = mkdtempSync(join(tmpdir(), 'ikari-import-'));
afterAll(() => rmSync(temp, { recursive: true, force: true, maxRetries: 3 }));
const projectId = '10000000-0000-4000-8000-000000000001', mediaId = '10000000-0000-4000-8000-000000000002', categoryId = '10000000-0000-4000-8000-000000000003';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
let directory: string;
function fixture() {
  const path = join(temp, randomUUID());
  mkdirSync(join(path, 'assets', 'media'), { recursive: true }); mkdirSync(join(path, 'assets', 'excerpts'));
  const image = Buffer.from('verified-image'), clip = Buffer.from('verified-original-video'), now = '2026-10-15T12:00:00.000Z', sourceUrl = 'https://x.com/editor/status/123';
  const media = { id: mediaId, filename: `${mediaId}.webp`, mime: 'image/webp', size: image.length, width: 1, height: 1, alt: 'Artwork credit', createdAt: now, checksum: digest(image), storageKey: `media/${mediaId}.webp`, originalKey: null };
  const entry = { postId: '123', sourceUrl, filename: '123.mp4', sha256: digest(clip), size: clip.length, duration: 1, width: 1, height: 1, artist: 'Author' };
  const catalog = { version: 1, exportedAt: now,
    projects: [{ id: projectId, slug: 'commission', title: 'Commission', summary: '', description: '', categoryId, coverMediaId: mediaId, coverUrl: `/media/${mediaId}`, coverAlt: 'Artwork credit', videoUrl: '', sourceUrl, featured: true, sortOrder: 0, status: 'published', createdAt: now, updatedAt: now }],
    categories: [{ id: categoryId, name: 'Animation', slug: 'animation', sortOrder: 0 }],
    settings: { brandName: 'Ikari', headline: 'Headline', subheadline: '', about: '', email: '', instagramUrl: '', accentColor: '#111111', servicesText: '', availability: '' },
    media: [media], excerpts: [{ projectId, entry, storageKey: 'excerpts/123.mp4' }] };
  const counts = { projects: 1, categories: 1, media: 1, excerpts: 1, assets: 2 };
  const manifest = { version: 1, counts, assets: [
    { path: `assets/${media.storageKey}`, storageKey: media.storageKey, sha256: media.checksum, size: image.length, contentType: 'image/webp', publicUrl: `/media/${mediaId}` },
    { path: 'assets/excerpts/123.mp4', storageKey: 'excerpts/123.mp4', sha256: entry.sha256, size: clip.length, contentType: 'video/mp4', publicUrl: `/trechos/${projectId}` }
  ] };
  writeFileSync(join(path, 'catalog.json'), JSON.stringify(catalog)); writeFileSync(join(path, 'assets-manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(path, 'assets', media.storageKey), image); writeFileSync(join(path, 'assets', 'excerpts', '123.mp4'), clip);
  return path;
}
function mutate(file: string, transform: (value: any) => void) {
  const path = join(directory, file), value = JSON.parse(readFileSync(path, 'utf8')); transform(value); writeFileSync(path, JSON.stringify(value));
}
function remote() {
  const files = new Map<string, Buffer>(); let readError: object | null = null, uploadError = false, rpcError = false;
  const download = vi.fn(async (key: string) => ({ data: files.has(key) ? new Blob([new Uint8Array(files.get(key)!)]) : null, error: readError || (files.has(key) ? null : { statusCode: '404' }) }));
  const upload = vi.fn(async (key: string, bytes: Uint8Array, options: { upsert: boolean }) => {
    if (uploadError || (files.has(key) && !options.upsert)) return { data: null, error: { statusCode: '409' } };
    files.set(key, Buffer.from(bytes)); return { data: { path: key }, error: null };
  });
  const rpc = vi.fn(async (_name: string, args: { batch: any }) => ({ data: rpcError ? null : { projects: args.batch.projects.length, categories: args.batch.categories.length, media: args.batch.media.length, excerpts: args.batch.excerpts.length }, error: rpcError ? { message: 'private diagnostics' } : null }));
  const client = { storage: { from: vi.fn(() => ({ download, upload })) }, rpc } as unknown as SupabaseClient;
  return { client, files, download, upload, rpc, setReadError: (error: object) => { readError = error; }, failUpload: () => { uploadError = true; }, failRpc: () => { rpcError = true; } };
}
beforeEach(() => { directory = fixture(); });

it('dry-run validates every local checksum without constructing or accessing a remote client', async () => {
  const forbidden = new Proxy({}, { get: () => { throw new Error('Network access in dry-run'); } }) as SupabaseClient;
  expect(await importCloudCatalog(directory, { dryRun: true, client: forbidden })).toMatchObject({ dryRun: true, projects: 1, media: 1, excerpts: 1, uploaded: 0, reused: 0 });
});
it('uploads immutable missing assets, round-trips their SHA and imports the catalog in one RPC', async () => {
  const cloud = remote(); const report = await importCloudCatalog(directory, { client: cloud.client });
  expect(report).toMatchObject({ uploaded: 2, reused: 0, dryRun: false });
  expect(cloud.download).toHaveBeenCalledTimes(4); expect(cloud.upload).toHaveBeenCalledTimes(2);
  for (const call of cloud.upload.mock.calls) expect(call[2]).toMatchObject({ upsert: false });
  expect(cloud.rpc).toHaveBeenCalledOnce(); expect(cloud.rpc.mock.calls[0][0]).toBe('ikari_import_catalog');
  expect(cloud.rpc.mock.calls[0][1].batch.projects[0].id).toBe(projectId);
  expect(cloud.rpc.mock.calls[0][1].batch.excerpts[0].entry.artist).toBe('Author');
});
it('repeating the same import reuses identical remote bytes without uploading or changing IDs', async () => {
  const cloud = remote(); await importCloudCatalog(directory, { client: cloud.client }); cloud.upload.mockClear();
  expect(await importCloudCatalog(directory, { client: cloud.client })).toMatchObject({ uploaded: 0, reused: 2 });
  expect(cloud.upload).not.toHaveBeenCalled(); expect(cloud.files).toHaveLength(2);
  expect(cloud.rpc.mock.calls[0][1]).toEqual(cloud.rpc.mock.calls[1][1]);
});
it('refuses changed local assets and never touches the remote service', async () => {
  const cloud = remote(); writeFileSync(join(directory, 'assets/excerpts/123.mp4'), 'tampered');
  await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow('Integridade');
  expect(cloud.download).not.toHaveBeenCalled(); expect(cloud.rpc).not.toHaveBeenCalled();
});
it('refuses a mismatched existing remote object without overwriting it or publishing metadata', async () => {
  const cloud = remote(); cloud.files.set(`media/${mediaId}.webp`, Buffer.from('different bytes'));
  await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow('Asset remoto diverge');
  expect(cloud.upload).not.toHaveBeenCalled(); expect(cloud.rpc).not.toHaveBeenCalled();
});
it('does not treat permission errors as a missing file', async () => {
  const cloud = remote(); cloud.setReadError({ statusCode: '403', message: 'secret diagnostics' });
  await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow('Não foi possível verificar');
  expect(cloud.upload).not.toHaveBeenCalled(); expect(cloud.rpc).not.toHaveBeenCalled();
});
it('recognizes the SDK NoSuchKey code without relying on an HTTP-400 message', async () => {
  const cloud = remote();
  cloud.download.mockImplementationOnce(async () => ({ data: null, error: { status: 400, statusCode: 'NoSuchKey', code: 'NoSuchKey' } }));
  expect(await importCloudCatalog(directory, { client: cloud.client })).toMatchObject({ uploaded: 2, reused: 0 });
});
it('accepts a concurrent import only if the winning upload has the identical approved bytes', async () => {
  const cloud = remote();
  cloud.upload.mockImplementationOnce(async (key, bytes) => {
    cloud.files.set(key, Buffer.from(bytes)); return { data: null, error: { statusCode: '409' } };
  });
  expect(await importCloudCatalog(directory, { client: cloud.client })).toMatchObject({ uploaded: 1, reused: 1 });
  expect(cloud.rpc).toHaveBeenCalledOnce();
});
it('does not publish metadata when an asset upload fails', async () => {
  const cloud = remote(); cloud.failUpload();
  await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow('sem sobrescrever');
  expect(cloud.rpc).not.toHaveBeenCalled();
});
it('keeps verified private assets reusable after the catalog transaction fails', async () => {
  const cloud = remote(); cloud.failRpc();
  await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow('transação do catálogo falhou');
  expect(cloud.files.size).toBe(2); expect(cloud.rpc).toHaveBeenCalledOnce();
});
it.each([
  ['extra private section', () => mutate('catalog.json', value => { value.inquiries = [{ brief: 'PRIVATE_CANARY' }]; })],
  ['draft record', () => mutate('catalog.json', value => { value.projects[0].status = 'draft'; })],
  ['extra settings field', () => mutate('catalog.json', value => { value.settings.serviceKey = 'PRIVATE_CANARY'; })],
  ['changed checksum', () => mutate('assets-manifest.json', value => { value.assets[0].sha256 = 'a'.repeat(64); })],
  ['missing category', () => mutate('catalog.json', value => { value.projects[0].categoryId = mediaId; })],
  ['source mismatch', () => mutate('catalog.json', value => { value.projects[0].sourceUrl = 'https://x.com/editor/status/456'; })],
  ['path traversal', () => mutate('assets-manifest.json', value => { value.assets[0].path = '../private'; })],
  ['oversized original', () => mutate('assets-manifest.json', value => { value.assets[1].size = MAX_CLOUD_ASSET_BYTES + 1; })],
  ['wrong counts', () => mutate('assets-manifest.json', value => { value.counts.projects = 23; })]
])('rejects %s before any network request', async (_label, change) => {
  change(); const cloud = remote(); await expect(importCloudCatalog(directory, { client: cloud.client })).rejects.toThrow();
  expect(cloud.download).not.toHaveBeenCalled(); expect(cloud.rpc).not.toHaveBeenCalled();
});
