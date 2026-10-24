import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const recoveryStore = vi.hoisted(() => ({ tickets: new Map<string,string>() }));
vi.mock('../src/lib/server/cloud/client',()=>({getCloudServiceClient:()=>({rpc:vi.fn(async(name:string,args:any)=>{const key=args.ticket_digest;if(name==='ikari_issue_password_recovery'){recoveryStore.tickets.set(key,args.auth_session);return {data:true,error:null};}const found=recoveryStore.tickets.get(key)===args.auth_session;if(name==='ikari_consume_password_recovery'&&found)recoveryStore.tickets.delete(key);return {data:found,error:null};})})}));
const ownerId = '10000000-0000-4000-8000-000000000001';
const recoveryRoute = () => import('../src/routes/(admin)/admin/recuperar/+page.server');
const passwordRoute = () => import('../src/routes/(admin)/admin/redefinir/+page.server');
const callbackRoute = () => import('../src/routes/auth/callback/+page.server');

const sessionId='20000000-0000-4000-8000-000000000002';
function eventFixture(values: Record<string, string> = {}, query = '', isOwner = true) {
  const client = {
    auth: {
      getClaims:vi.fn(async()=>({data:{claims:{sub:ownerId,session_id:sessionId,amr:[{method:'recovery',timestamp:Math.floor(Date.now()/1000)}]}},error:null})),
      getUser: vi.fn(async () => ({ data: { user: { id: ownerId } }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null as Error | null })),
      exchangeCodeForSession: vi.fn(async () => ({ data: { user: { id: ownerId }, session: {access_token:'fixture-verified-access'} }, error: null as Error | null })),
      verifyOtp: vi.fn(async () => ({ data: { user: { id: ownerId }, session: {access_token:'fixture-verified-access'} }, error: null as Error | null })),
      updateUser: vi.fn(async () => ({ data: { user: { id: ownerId } }, error: null as Error | null })),
      signOut: vi.fn(async () => ({ error: null as Error | null }))
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: isOwner ? { user_id: ownerId } : null, error: null }) }) }) }))
  };
  const jar=new Map<string,string>();
  return { cookies:{get:(key:string)=>jar.get(key),set:(key:string,value:string)=>jar.set(key,value),delete:(key:string)=>jar.delete(key)},
    locals: { supabase: client }, url: new URL(`https://studio.test/auth/callback${query}`),
    request: new Request('https://studio.test/admin/redefinir', { method: 'POST', headers: { origin: 'https://studio.test' }, body: new URLSearchParams(values) }),
    getClientAddress: () => randomUUID(), setHeaders: vi.fn(), client
  };
}
beforeEach(() => {vi.stubEnv('ORIGIN','https://studio.test');vi.stubEnv('INQUIRY_ENCRYPTION_KEY',Buffer.alloc(32,7).toString('base64'));recoveryStore.tickets.clear();});
afterEach(() => vi.unstubAllEnvs());

it('requests recovery only with the fixed trusted callback and returns no delivery claim', async () => {
  const route = await recoveryRoute(), event = eventFixture({ email: 'fixture@example.test', next: 'https://evil.test' });
  const result = await route.actions.default!(event as never) as any;
  expect(event.client.auth.resetPasswordForEmail).toHaveBeenCalledWith('fixture@example.test', { redirectTo: 'https://studio.test/auth/callback?next=recovery' });
  expect(result.requested).toBe(true); expect(result.success).toBeUndefined();
});

it('uses the same neutral recovery response for provider rejection and unknown accounts', async () => {
  const route = await recoveryRoute(), accepted = eventFixture({ email: 'fixture@example.test' }), rejected = eventFixture({ email: 'fixture@example.test' });
  rejected.client.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: Error('account does not exist') });
  expect(await route.actions.default!(accepted as never)).toEqual(await route.actions.default!(rejected as never));
});

it('rejects recovery with invalid email or cross-site origin before contacting Auth', async () => {
  const route = await recoveryRoute(), event = eventFixture({ email: 'not-email' });
  expect((await route.actions.default!(event as never) as any).status).toBe(400);
  expect(event.client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  event.request = new Request('https://studio.test/admin/recuperar', { method: 'POST', headers: { origin: 'https://evil.test' }, body: new URLSearchParams({ email: 'fixture@example.test' }) });
  expect((await route.actions.default!(event as never) as any).status).toBe(403);
  expect(event.client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
});

it('exchanges PKCE then checks owner before the fixed recovery redirect', async () => {
  const route = await callbackRoute(), event = eventFixture({}, '?code=one-time-code&next=recovery');
  await expect(route.load(event as never)).rejects.toMatchObject({ status: 303, location: '/admin/redefinir' });
  expect(event.client.auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
  expect(event.client.auth.getUser).toHaveBeenCalled(); expect(event.client.from).toHaveBeenCalledWith('ikari_editors');
});

it('routes invite OTP to password setup only after server authorization and one-time proof', async () => {
  const route = await callbackRoute(), event = eventFixture({}, '?token_hash=private-invite-hash&type=invite&next=invite');
  await expect(route.load(event as never)).rejects.toMatchObject({ status: 303, location: '/admin/redefinir' });
  expect(event.cookies.get('ikari_credential_proof')).toBeTruthy();
  expect(event.client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'private-invite-hash', type: 'invite' });
});

it.each(['?code=code&next=https://evil.test', '?code=code&next=//evil.test', '?token_hash=hash&type=signup', '?code=code&token_hash=hash&type=invite', '?error=access_denied', ''])('rejects invalid callback input %s without exchanging or reflecting it', async (query) => {
  const route = await callbackRoute(), event = eventFixture({}, query);
  const result = await route.load(event as never) as any;
  expect(result.error).toBeTruthy();
  expect(event.client.auth.exchangeCodeForSession).not.toHaveBeenCalled(); expect(event.client.auth.verifyOtp).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain('evil.test');
});

it('does not redirect to a private route on expired/replayed code or unauthorized identity', async () => {
  const route = await callbackRoute(), expired = eventFixture({}, '?code=expired&next=recovery'), unauthorized = eventFixture({}, '?code=valid&next=invite', false);
  expired.client.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: { id: ownerId }, session: {access_token:'expired'} }, error: Error('expired code details') });
  expect((await route.load(expired as never) as any).error).toBeTruthy();
  expect((await route.load(unauthorized as never) as any).error).toBeTruthy();
  expect(unauthorized.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('requires the editor allowlist before updating a password', async () => {
  const route = await passwordRoute(), event = eventFixture({ password: 'FixturePassword123!', confirmation: 'FixturePassword123!' }, '', false);
  expect((await route.actions.default!(event as never) as any).status).toBe(403);
  expect(event.client.auth.updateUser).not.toHaveBeenCalled();
});

it.each([
  { password: 'short', confirmation: 'short' },
  { password: 'x'.repeat(129), confirmation: 'x'.repeat(129) },
  { password: 'FixturePassword123!', confirmation: 'different' }
])('does not send invalid or mismatched passwords to Supabase', async (values) => {
  const route = await passwordRoute(), event = eventFixture(values);
  const result = await route.actions.default!(event as never) as any;
  expect(result.status).toBe(400); expect(event.client.auth.updateUser).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain(values.password);
});

async function authorizeRecovery(event:ReturnType<typeof eventFixture>){await (await import('../src/lib/server/cloud/credential-proof')).issueCredentialProof(event.locals as never,event.cookies as never,ownerId,'fixture-verified-access','recovery');}

it('reports password success only after update and revokes other refresh sessions', async () => {
  const route = await passwordRoute(), event = eventFixture({ password: 'FixturePassword123!', confirmation: 'FixturePassword123!' });
  await authorizeRecovery(event);
  await expect(route.actions.default!(event as never)).rejects.toMatchObject({status:303,location:'/admin/conta'});
  expect(event.cookies.get('ikari_password_changed')).toBe('changed');
  expect(event.client.auth.updateUser).toHaveBeenCalledWith({ password: 'FixturePassword123!' });
  expect(event.client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  expect(event.cookies.get('ikari_password_changed')).not.toContain('FixturePassword123!');
});

it('preserves failure when Auth rejects the new password and accurately warns on revocation failure', async () => {
  const route = await passwordRoute(), failed = eventFixture({ password: 'FixturePassword123!', confirmation: 'FixturePassword123!' });
  failed.client.auth.updateUser.mockResolvedValueOnce({ data: { user: { id: ownerId } }, error: Error('provider error detail') });
  await authorizeRecovery(failed);
  const rejected = await route.actions.default!(failed as never) as any;
  expect(rejected.status).toBe(400); expect(rejected.data.success).toBeUndefined(); expect(failed.client.auth.signOut).not.toHaveBeenCalled();
  const partial = eventFixture({ password: 'FixturePassword123!', confirmation: 'FixturePassword123!' });
  partial.client.auth.signOut.mockResolvedValueOnce({ error: Error('revocation unavailable') });
  await authorizeRecovery(partial);
  await expect(route.actions.default!(partial as never)).rejects.toMatchObject({status:303,location:'/admin/conta'});
  expect(partial.cookies.get('ikari_password_changed')).toBe('changed-with-warning');
});


it('denies password reset from an ordinary owner session without recovery proof',async()=>{
 const event=eventFixture({password:'FixturePassword123!',confirmation:'FixturePassword123!'});
 const result=await(await passwordRoute()).actions.default!(event as never) as any;
 expect(result.status).toBe(403);expect(event.client.auth.updateUser).not.toHaveBeenCalled();
});
it('does not trust next=recovery on a PKCE session without verified recovery AMR',async()=>{
 const event=eventFixture({},'?code=ordinary-login-code&next=recovery');
 event.client.auth.getClaims.mockResolvedValueOnce({data:{claims:{sub:ownerId,session_id:sessionId,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]}},error:null});
 expect((await(await callbackRoute()).load(event as never) as any).error).toBeTruthy();
 expect(event.cookies.get('ikari_credential_proof')).toBeUndefined();
});
it('atomically consumes recovery proof and rejects cookie replay from another server',async()=>{
 const event=eventFixture({password:'FixturePassword123!',confirmation:'FixturePassword123!'});
 const replayRequest=event.request.clone();
 await authorizeRecovery(event);const ticket=event.cookies.get('ikari_credential_proof')!;
 await expect((await passwordRoute()).actions.default!(event as never)).rejects.toMatchObject({status:303,location:'/admin/conta'});
 event.cookies.set('ikari_credential_proof',ticket);event.client.auth.updateUser.mockClear();
 event.request=replayRequest;
 expect((await(await passwordRoute()).actions.default!(event as never) as any).status).toBe(403);
 expect(event.client.auth.updateUser).not.toHaveBeenCalled();
});
it('rejects a signed proof when the current verified session differs',async()=>{
 const event=eventFixture({password:'FixturePassword123!',confirmation:'FixturePassword123!'});
 await authorizeRecovery(event);
 event.client.auth.getClaims.mockResolvedValueOnce({data:{claims:{sub:ownerId,session_id:'30000000-0000-4000-8000-000000000003',amr:[]}},error:null});
 expect((await(await passwordRoute()).actions.default!(event as never) as any).status).toBe(403);expect(event.client.auth.updateUser).not.toHaveBeenCalled();
});

it('rejects altered and expired signed tickets without calling updateUser',async()=>{
 const event=eventFixture({password:'FixturePassword123!',confirmation:'FixturePassword123!'});
 const expiredRequest=event.request.clone();
 await authorizeRecovery(event);const original=event.cookies.get('ikari_credential_proof')!;
 event.cookies.set('ikari_credential_proof',original.slice(0,-2)+'aa');
 expect((await(await passwordRoute()).actions.default!(event as never) as any).status).toBe(403);
 event.cookies.set('ikari_credential_proof',original);
 event.request=expiredRequest;
 const now=Date.now();const clock=vi.spyOn(Date,'now').mockReturnValue(now+601000);
 try{expect((await(await passwordRoute()).actions.default!(event as never) as any).status).toBe(403);}finally{clock.mockRestore();}
 expect(event.client.auth.updateUser).not.toHaveBeenCalled();
});
