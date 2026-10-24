import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const engine=process.env.IKARI_TEST_PGLITE_MODULE;
describe.skipIf(!engine)('password session enforcement in PostgreSQL RLS',()=>{
 let db:any;const owner='10000000-0000-4000-8000-000000000001';
 beforeAll(async()=>{
  const {PGlite}=await import(/* @vite-ignore */ engine!);db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema ikari_private;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table public.ikari_editors(user_id uuid primary key);insert into public.ikari_editors values('${owner}');
   grant usage on schema auth,ikari_private to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
   create table public.private_fixture(secret text);insert into public.private_fixture values('encrypted-envelope');alter table public.private_fixture enable row level security;grant select on public.private_fixture to anon,authenticated;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261015233000_ikari_password_sessions.sql',import.meta.url),'utf8'));
  await db.exec('create policy owner_only on public.private_fixture for select using((select ikari_private.is_owner()))');
 },60000);
 afterAll(async()=>await db?.close());
 async function count(claims:unknown,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role '+role);return(await db.query('select count(*)::int as n from public.private_fixture')).rows[0].n;}
 it('rejects anonymous, old/magic/recovery tokens and other users directly at the data boundary',async()=>{
  const now=Math.floor(Date.now()/1000),base={sub:owner};
  expect(await count({},'anon')).toBe(0);
  for(const amr of [[],[{method:'otp',timestamp:now}],[{method:'recovery',timestamp:now}],[{method:'password',timestamp:now-1801}],[{method:'password',timestamp:now+60}],[{method:'password',timestamp:'bad'}]])expect(await count({...base,amr})).toBe(0);
  expect(await count({...base,amr:[{method:'password',timestamp:now}]})).toBe(1);
  expect(await count({sub:'10000000-0000-4000-8000-000000000002',amr:[{method:'password',timestamp:now}]})).toBe(0);
 });
});
