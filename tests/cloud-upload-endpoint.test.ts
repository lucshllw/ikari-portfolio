import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ begin: vi.fn(), complete: vi.fn(), owner: vi.fn() }));
vi.mock('../src/lib/server/access', () => ({ requireOwner: calls.owner }));
vi.mock('../src/lib/server/catalog', () => ({ beginImageUpload: calls.begin, completeImageUpload: calls.complete }));
import { POST } from '../src/routes/(admin)/admin/midia/envio/+server';
const metadata = { phase: 'begin', filename: 'image.png', mime: 'image/png', alt: 'Cover', size: 1024 };
function event(body: unknown, origin = 'https://ikari.test', contentType = 'application/json') {
  return { locals: {}, request: new Request('https://ikari.test/admin/midia/envio', { method: 'POST', headers: { origin, 'content-type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body) }) } as Parameters<typeof POST>[0];
}
beforeEach(() => {
  vi.stubEnv('FRAME_STORAGE', 'supabase'); vi.stubEnv('ORIGIN', 'https://ikari.test');
  calls.owner.mockReset().mockResolvedValue({ id: 'owner' }); calls.begin.mockReset().mockResolvedValue({ uploadId: 'test', signedUrl: 'https://storage.test/signed' }); calls.complete.mockReset().mockResolvedValue({ id: 'media' });
});
afterEach(() => vi.unstubAllEnvs());
it('requires the verified owner and exact origin before issuing an upload capability', async () => {
  const response = await POST(event(metadata, 'https://attacker.test'));
  expect(response.status).toBe(403); expect(calls.begin).not.toHaveBeenCalled(); expect(calls.complete).not.toHaveBeenCalled();
});
it('propagates authorization failure without reading the request or issuing a ticket', async () => {
  calls.owner.mockRejectedValue(new Error('Not owner'));
  await expect(POST(event(metadata))).rejects.toThrow('Not owner'); expect(calls.begin).not.toHaveBeenCalled();
});
it('bounds metadata request size and rejects files above 12MiB before Storage access', async () => {
  expect((await POST(event('x'.repeat(8193)))).status).toBe(413);
  expect((await POST(event({ ...metadata, size: 12 * 1024 * 1024 + 1 }))).status).toBe(400);
  expect(calls.begin).not.toHaveBeenCalled();
});
it('passes only image metadata to the authenticated upload and finalization functions', async () => {
  const response = await POST(event(metadata)); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(calls.begin).toHaveBeenCalledWith({ filename: 'image.png', mime: 'image/png', alt: 'Cover' }, 'owner');
  const complete = await POST(event({ ...metadata, phase: 'complete', uploadId: '10000000-0000-4000-8000-000000000003' }));
  expect(complete.status).toBe(200); expect(calls.complete).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000003', { filename: 'image.png', mime: 'image/png', alt: 'Cover' }, 'owner');
});
