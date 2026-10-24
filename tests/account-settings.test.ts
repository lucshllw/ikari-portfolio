import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('../src/lib/server/storage-mode', () => ({ CLOUD_BUILD: false, isCloud: () => true }));
const owner = '10000000-0000-4000-8000-000000000001';
const route = () => import('../src/routes/(admin)/admin/conta/+page.server');
function fixture(values: Record<string, string> = {}, authorized = true) {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: owner, email: 'verified@example.test', new_email: '' } }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: owner } }, error: null as Error | null })),
    updateUser: vi.fn(async () => ({ data: { user: { id: owner } }, error: null as Error | null })),
    signOut: vi.fn(async () => ({ error: null as Error | null }))
  };
  const client = { auth, from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: authorized ? { user_id: owner } : null, error: null }) }) }) })) };
  return { locals: { supabase: client }, request: new Request('https://studio.test/admin/conta', { method: 'POST', headers: { origin: 'https://studio.test' }, body: new URLSearchParams(values) }), cookies: {}, getClientAddress: () => randomUUID(), setHeaders: vi.fn(), auth };
}
beforeEach(() => vi.stubEnv('ORIGIN', 'https://studio.test'));
afterEach(() => vi.unstubAllEnvs());
it('reauthenticates only the verified owner email before requesting email change to a fixed callback', async () => {
  const event = fixture({ email: 'new@example.test', currentPassword: 'CurrentFixture123!' });
  const result = await (await route()).actions.email!(event as never) as any;
  expect(event.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'verified@example.test', password: 'CurrentFixture123!' });
  expect(event.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.test' }, { emailRedirectTo: 'https://studio.test/auth/callback?next=account' });
  expect(result.requested).toBe(true); expect(result.success).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain('CurrentFixture');
});
it('denies unlisted identities before reauthentication or mutation', async () => {
  const event = fixture({ email: 'new@example.test', currentPassword: 'CurrentFixture123!' }, false);
  expect((await (await route()).actions.email!(event as never) as any).status).toBe(403);
  expect(event.auth.signInWithPassword).not.toHaveBeenCalled(); expect(event.auth.updateUser).not.toHaveBeenCalled();
});
it('rejects invalid email and cross origin without calling the auth update', async () => {
  const event = fixture({ email: 'invalid', currentPassword: 'CurrentFixture123!' });
  expect((await (await route()).actions.email!(event as never) as any).status).toBe(400);
  event.request = new Request('https://studio.test/admin/conta', {method:'POST',headers:{origin:'https://evil.test'},body:new URLSearchParams({email:'new@example.test',currentPassword:'CurrentFixture123!'})});
  expect((await (await route()).actions.email!(event as never) as any).status).toBe(403);
  expect(event.auth.updateUser).not.toHaveBeenCalled();
});
it('a wrong current password cannot change either credential', async () => {
  const event = fixture({ currentPassword: 'WrongFixture123!', password: 'NextFixturePassword123!', confirmation: 'NextFixturePassword123!' });
  event.auth.signInWithPassword.mockResolvedValueOnce({data:{user:{id:owner}},error:Error('provider detail')});
  const result = await (await route()).actions.password!(event as never) as any;
  expect(result.status).toBe(400); expect(event.auth.updateUser).not.toHaveBeenCalled(); expect(JSON.stringify(result)).not.toContain('provider detail');
});
it('changes a validated password and revokes other sessions after success', async () => {
  const event = fixture({ currentPassword: 'CurrentFixture123!', password: 'NextFixturePassword123!', confirmation: 'NextFixturePassword123!' });
  const result = await (await route()).actions.password!(event as never) as any;
  expect(result.success).toBe(true); expect(event.auth.updateUser).toHaveBeenCalledWith({password:'NextFixturePassword123!'});
  expect(event.auth.signOut).toHaveBeenCalledWith({scope:'others'});
  expect(JSON.stringify(result)).not.toContain('NextFixture');
});
it('does not accept a weak, mismatched or unchanged password', async () => {
  for (const [password, confirmation] of [['short','short'],['NextFixture123!','DifferentFixture123!'],['CurrentFixture123!','CurrentFixture123!']]) {
    const event = fixture({currentPassword:'CurrentFixture123!',password,confirmation});
    expect((await (await route()).actions.password!(event as never) as any).status).toBe(400);
    expect(event.auth.updateUser).not.toHaveBeenCalled();
  }
});
it('email change callbacks remain owner-authorized and use a fixed account destination', async () => {
  const event = fixture();
  const client = event.locals.supabase as any;
  client.auth.exchangeCodeForSession = vi.fn(async () => ({data:{session:{},user:{id:owner}},error:null}));
  const load = (await import('../src/routes/auth/callback/+page.server')).load;
  await expect(load({...event,url:new URL('https://studio.test/auth/callback?code=fixed-code&next=account')} as never)).rejects.toMatchObject({status:303,location:'/admin/conta'});
});
