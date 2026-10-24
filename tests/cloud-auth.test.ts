import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const ownerId = '10000000-0000-4000-8000-000000000001';
const loadAuth = () => import('../src/lib/server/cloud/auth');
beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

function clientFixture(options: { userId?: string | null; memberId?: string | null; authError?: boolean; policyError?: boolean } = {}) {
  const userId = options.userId === undefined ? ownerId : options.userId;
  const user = userId ? { id: userId } : null;
  const db = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({ data: options.memberId === null ? null : { user_id: options.memberId || ownerId }, error: options.policyError ? Error('private policy details') : null })) };
  db.select.mockReturnValue(db); db.eq.mockReturnValue(db);
  return { auth: { getUser: vi.fn(async () => ({ data: { user }, error: options.authError ? Error('provider detail') : null })) }, from: vi.fn(() => db), db };
}

it('returns only a server-confirmed editor id from the authenticated RLS client', async () => {
  const { requireCloudOwner } = await loadAuth();
  const client = clientFixture();
  expect(await requireCloudOwner({ supabase: client as never })).toEqual({ id: ownerId });
  expect(client.from).toHaveBeenCalledWith('ikari_editors');
  expect(client.db.eq).toHaveBeenCalledWith('user_id', ownerId);
});

it.each([
  { label: 'anonymous', userId: null }, { label: 'unlisted user', memberId: null },
  { label: 'mismatched editor', memberId: randomUUID() }, { label: 'unverified identity', authError: true },
  { label: 'RLS unavailable', policyError: true }
])('denies $label without leaking provider errors', async (options) => {
  const { requireCloudOwner } = await loadAuth();
  const client = clientFixture(options);
  await expect(requireCloudOwner({ supabase: client as never })).rejects.toThrow('Acesso administrativo necessário.');
});

it('fails closed without the request-scoped SSR client even if locals contains a forged user', async () => {
  const { requireCloudOwner } = await loadAuth();
  await expect(requireCloudOwner({ user: { id: ownerId } } as never)).rejects.toThrow();
});

it('requires an explicit trusted application origin instead of using incoming Host', async () => {
  const { cloudAuthOrigin, assertCloudAuthOrigin } = await loadAuth();
  delete process.env.ORIGIN;
  expect(() => cloudAuthOrigin()).toThrow();
  for (const origin of ['https://studio.test/path', 'https://studio.test/?x=1', 'https://user:pass@studio.test', 'http://public.test', 'https://studio.test/#x']) {
    vi.stubEnv('ORIGIN', origin); expect(() => cloudAuthOrigin()).toThrow();
  }
  vi.stubEnv('ORIGIN', 'https://studio.test');
  expect(cloudAuthOrigin()).toBe('https://studio.test');
  expect(() => assertCloudAuthOrigin(new Request('https://studio.test/admin/redefinir', { method: 'POST', headers: { origin: 'https://evil.test' } }))).toThrow();
  expect(() => assertCloudAuthOrigin(new Request('https://studio.test/admin/redefinir', { method: 'POST', headers: { origin: 'https://studio.test' } }))).not.toThrow();
});
