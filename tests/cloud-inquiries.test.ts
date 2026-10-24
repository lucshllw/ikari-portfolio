import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn(), from: vi.fn() }));
vi.mock('../src/lib/server/cloud/client', () => ({ getCloudServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('../src/lib/server/cloud/auth', () => ({ requireCloudOwner: mocks.owner }));
import { createCloudInquiry, listCloudInquiries, updateCloudInquiry, deleteCloudInquiry, saveCloudInquiryStudio } from '../src/lib/server/cloud/inquiries';
import { encryptInquiry, decryptInquiry } from '../src/lib/server/cloud/inquiry-crypto';
const key = '68cbb87f-8a8d-4de7-8ec1-c38528cc7916';
const payload = { name: 'Visitante teste', email: 'teste@example.com', service: 'Animação 2D', brief: 'Uma ideia de teste controlado.' };
describe('inbox cloud', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('INQUIRY_ENCRYPTION_KEY', Buffer.alloc(32, 17).toString('base64')); mocks.owner.mockResolvedValue({ id: key }); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it('envia somente ciphertext, UUID e chave opaca ao banco', async () => {
    mocks.rpc.mockResolvedValue({ data: {id:key,created:true}, error: null });
    expect(await createCloudInquiry(payload, key, '127.0.0.1')).toEqual({ id: key,created:true });
    const params = mocks.rpc.mock.calls[0][1];
    expect(params.encrypted_payload).toMatch(/^v1\./);
    expect(params.client_key).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(params)).not.toContain(payload.email);
    expect(JSON.stringify(params)).not.toContain('127.0.0.1');
  });
  it('falha fechada sem chave antes de gravar', async () => {
    delete process.env.INQUIRY_ENCRYPTION_KEY;
    await expect(createCloudInquiry(payload, key, 'ip')).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps the created flag false on replay, so notification callers can skip it',async()=>{mocks.rpc.mockResolvedValue({data:{id:key,created:false},error:null});expect(await createCloudInquiry(payload,key,'ip')).toEqual({id:key,created:false});expect(mocks.rpc.mock.calls[0][0]).toBe('ikari_receive_inquiry_v14');});
  it('não confirma erro de persistência', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private upstream' } });
    await expect(createCloudInquiry(payload, key, 'ip')).rejects.toThrow('Não foi possível');
  });
  it('nega leitura antes de consultar e decifrar', async () => {
    mocks.owner.mockRejectedValue(new Error('Acesso negado'));
    await expect(listCloudInquiries({ supabase: { from: mocks.from } } as never, 1)).rejects.toThrow(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('pagina, conta e decifra usando o cliente da sessão', async () => {
    const result = { data: [{ id: key, requestKey: key, payload: encryptInquiry(payload, key), status: 'new', createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z' }], count: 31, error: null };
    const q = { select: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue(result) };
    mocks.from.mockReturnValue(q);
    const response = await listCloudInquiries({ supabase: { from: mocks.from } } as never, 2, 'new');
    expect(response.total).toBe(31); expect(response.inquiries[0].email).toBe(payload.email); expect(q.range).toHaveBeenCalledWith(25, 49);
  });
  it('nega alterações sem proprietário', async () => {
    mocks.owner.mockRejectedValue(new Error('Acesso negado'));
    await expect(updateCloudInquiry({} as never, key, 'archived')).rejects.toThrow(); await expect(deleteCloudInquiry({} as never, key)).rejects.toThrow(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('saves internal notes only inside the authenticated ciphertext envelope', async () => {
    const update = vi.fn().mockReturnThis(), maybeSingle = vi.fn().mockResolvedValueOnce({data:{requestKey:key,payload:encryptInquiry(payload,key)},error:null}).mockResolvedValueOnce({data:{id:key},error:null});
    const q = { select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),update,maybeSingle };
    mocks.from.mockReturnValue(q);
    await saveCloudInquiryStudio({supabase:{from:mocks.from}} as never,key,{status:'completed',priority:'urgent',notes:'Internal estimate, synthetic only.'});
    const stored=update.mock.calls[0][0];expect(stored).toMatchObject({status:'completed',priority:'urgent'});expect(JSON.stringify(stored)).not.toContain('Internal estimate');
    expect(decryptInquiry(stored.payload,key)).toMatchObject({...payload,notes:'Internal estimate, synthetic only.'});
  });
  it('soft-deletes without invoking DELETE on the cloud client', async () => {
    const update=vi.fn().mockReturnThis(),remove=vi.fn();const q={update,delete:remove,eq:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id:key},error:null})};mocks.from.mockReturnValue(q);
    await deleteCloudInquiry({supabase:{from:mocks.from}} as never,key);expect(remove).not.toHaveBeenCalled();expect(update.mock.calls[0][0].deletedAt).toEqual(expect.any(String));
  });
  it('rejects oversized notes before reading or updating the database', async () => {
    await expect(saveCloudInquiryStudio({supabase:{from:mocks.from}} as never,key,{status:'new',priority:'normal',notes:'x'.repeat(4001)})).rejects.toThrow();expect(mocks.from).not.toHaveBeenCalled();
  });
});

// Optional real PostgreSQL engine, installed only in the reviewer's scratch area.
// Point IKARI_TEST_PGLITE_MODULE at its file:// dist/index.js URL; no product dependency.
type SqlResult = { rows: Record<string, any>[] };
type SqlEngine = { exec(sql: string): Promise<unknown>; query(sql: string, params?: unknown[]): Promise<SqlResult>; close(): Promise<unknown> };
const pgliteModule = process.env.IKARI_TEST_PGLITE_MODULE;
describe.skipIf(!pgliteModule)('inbox SQL on local PostgreSQL/PGlite', () => {
  let database: SqlEngine;
  const clientKey = 'a'.repeat(64);
  const call = (requestKey = randomUUID(), encrypted = encryptInquiry(payload, requestKey), client = clientKey) => database.query(
    'select public.ikari_receive_inquiry($1::uuid,$2::text,$3::text) as id', [requestKey, encrypted, client]
  );
  beforeAll(async () => {
    const { PGlite } = await import(/* @vite-ignore */ pgliteModule!) as { PGlite: new () => SqlEngine };
    database = new PGlite();
    // Supabase platform objects are fixtures; catalog and inbox SQL are the real artifacts.
    await database.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
    `);
    await database.exec(readFileSync(new URL('../supabase/sql/catalog.sql', import.meta.url), 'utf8'));
    await database.exec(readFileSync(new URL('../supabase/sql/inbox.sql', import.meta.url), 'utf8'));
    await database.query('insert into auth.users(id) values($1)', [key]);
    await database.query('insert into public.ikari_editors(user_id) values($1)', [key]);
  }, 60_000);
  beforeEach(async () => {
    vi.stubEnv('INQUIRY_ENCRYPTION_KEY', Buffer.alloc(32, 17).toString('base64'));
    await database.exec('reset role; truncate public.ikari_inquiries, ikari_private.inquiry_limits; set role service_role;');
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { await database?.close(); });

  it('executes the RPC and makes replay idempotent without replacing ciphertext or spending rate budget', async () => {
    const requestKey = randomUUID(), original = encryptInquiry(payload, requestKey);
    const first = await call(requestKey, original), replay = await call(requestKey);
    expect(replay.rows[0].id).toBe(first.rows[0].id);
    const stored = await database.query('select payload from public.ikari_inquiries');
    expect(stored.rows).toEqual([{ payload: original }]);
    const limits = await database.query('select key,hits from ikari_private.inquiry_limits order by key');
    expect(limits.rows).toEqual([{ key: clientKey, hits: 1 }, { key: 'aggregate', hits: 1 }]);
  });

  it('allows six writes per client and rolls back aggregate increments on the seventh rejection', async () => {
    const requestKey = randomUUID(); await call(requestKey);
    for (let index = 1; index < 6; index++) await call();
    await expect(call()).rejects.toMatchObject({ code: 'P0001', message: 'Rate limited' });
    expect((await database.query('select count(*)::integer as n from public.ikari_inquiries')).rows[0].n).toBe(6);
    expect((await database.query('select hits from ikari_private.inquiry_limits order by key')).rows).toEqual([{ hits: 6 }, { hits: 6 }]);
    await expect(call(requestKey)).resolves.toBeTruthy();
  });

  it('enforces the aggregate cap across sixty distinct clients', async () => {
    for (let index = 1; index <= 60; index++) {
      const requestKey = randomUUID(); await call(requestKey, encryptInquiry(payload, requestKey), index.toString(16).padStart(64, '0'));
    }
    const requestKey = randomUUID();
    await expect(call(requestKey, encryptInquiry(payload, requestKey), 'b'.repeat(64))).rejects.toMatchObject({ code: 'P0001', message: 'Rate limited' });
    expect((await database.query('select count(*)::integer as n from public.ikari_inquiries')).rows[0].n).toBe(60);
  });

  it('resets stale windows and purges expired client metadata', async () => {
    await database.query(`insert into ikari_private.inquiry_limits(key,period_start,hits) values
      ('aggregate',date_trunc('minute',clock_timestamp()) - interval '1 minute',60),
      ($1,date_trunc('minute',clock_timestamp()) - interval '1 minute',6),
      ($2,date_trunc('minute',clock_timestamp()) - interval '3 minutes',6)`, [clientKey, 'c'.repeat(64)]);
    await call();
    expect((await database.query('select hits from ikari_private.inquiry_limits order by key')).rows).toEqual([{ hits: 1 }, { hits: 1 }]);
  });

  it('rejects null identity, invalid client keys and plaintext before storing a row or spending limits', async () => {
    const requestKey = randomUUID(), encrypted = encryptInquiry(payload, requestKey);
    for (const values of [[null, encrypted, clientKey], [requestKey, encrypted, null], [requestKey, encrypted, 'ip-address'], [requestKey, JSON.stringify(payload), clientKey], [requestKey, 'v1.' + 'A'.repeat(40), clientKey]]) {
      await expect(database.query('select public.ikari_receive_inquiry($1::uuid,$2::text,$3::text)', values)).rejects.toThrow();
    }
    expect((await database.query('select count(*)::integer as n from public.ikari_inquiries')).rows[0].n).toBe(0);
    expect((await database.query('select count(*)::integer as n from ikari_private.inquiry_limits')).rows[0].n).toBe(0);
  });

  it('denies anonymous SQL/RPC and authenticated non-editor reads or writes', async () => {
    const requestKey = randomUUID(), encrypted = encryptInquiry(payload, requestKey); await call(requestKey, encrypted);
    await database.exec('set role anon');
    await expect(database.query('select * from public.ikari_inquiries')).rejects.toMatchObject({ code: '42501' });
    await expect(call()).rejects.toMatchObject({ code: '42501' });
    await database.exec('set role authenticated');
    await database.query("select set_config('request.jwt.claim.sub',$1,false)", [randomUUID()]);
    expect((await database.query('select id from public.ikari_inquiries')).rows).toEqual([]);
    expect((await database.query("update public.ikari_inquiries set status='archived' returning id")).rows).toEqual([]);
    await expect(call(requestKey, encrypted)).rejects.toMatchObject({ code: '42501' });
    await expect(database.query('insert into public.ikari_inquiries("requestKey",payload) values($1,$2)', [randomUUID(), encrypted])).rejects.toMatchObject({ code: '42501' });
  });

  it('allows owner read/status/delete while keeping encrypted payload and request identity immutable to the editor', async () => {
    const requestKey = randomUUID(); await call(requestKey);
    await database.exec('set role authenticated');
    await database.query("select set_config('request.jwt.claim.sub',$1,false)", [key]);
    expect((await database.query('select id from public.ikari_inquiries')).rows).toHaveLength(1);
    expect((await database.query("update public.ikari_inquiries set status='in_progress',\"updatedAt\"=clock_timestamp() returning status")).rows).toEqual([{ status: 'in_progress' }]);
    await expect(database.query('update public.ikari_inquiries set payload=payload')).rejects.toMatchObject({ code: '42501' });
    await expect(database.query('update public.ikari_inquiries set "requestKey"="requestKey"')).rejects.toMatchObject({ code: '42501' });
    expect((await database.query('delete from public.ikari_inquiries returning id')).rows).toHaveLength(1);
  });
});
