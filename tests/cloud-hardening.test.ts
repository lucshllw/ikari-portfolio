import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type SqlEngine = {
  exec(sql: string): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, any>[] }>;
  close(): Promise<unknown>;
};
const pgliteModule = process.env.IKARI_TEST_PGLITE_MODULE;
const owner = '10000000-0000-4000-8000-000000000001', other = '10000000-0000-4000-8000-000000000002';
const media = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003'];
const projects = ['30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002'];

describe.skipIf(!pgliteModule)('advisor hardening on local PostgreSQL/PGlite', () => {
  let db: SqlEngine;
  const hardening = () => readFileSync(new URL('../supabase/sql/hardening.sql', import.meta.url), 'utf8');
  async function actor(role: 'anon' | 'authenticated' | 'postgres', id = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    if (role !== 'postgres') await db.exec(`set role ${role}`);
  }
  const counts = async () => {
    const result = await db.query(`select
      (select count(*)::integer from public.ikari_projects) as projects,
      (select count(*)::integer from public.ikari_media) as media,
      (select count(*)::integer from public.ikari_excerpts) as excerpts,
      (select count(*)::integer from public.ikari_categories) as categories,
      (select count(*)::integer from public.ikari_settings) as settings`);
    return result.rows[0];
  };

  beforeAll(async () => {
    const { PGlite } = await import(/* @vite-ignore */ pgliteModule!) as { PGlite: new () => SqlEngine };
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon,authenticated,service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
    `);
    await db.exec(readFileSync(new URL('../supabase/sql/catalog.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/sql/inbox.sql', import.meta.url), 'utf8'));
    // Models the platform's event-trigger function without importing remote definitions.
    await db.exec(`
      create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path='' as $$
      declare command record;
      begin
        for command in select * from pg_catalog.pg_event_trigger_ddl_commands() where command_tag='CREATE TABLE' and schema_name='public' loop
          execute pg_catalog.format('alter table %s enable row level security',command.object_identity);
        end loop;
      end $$;
      grant execute on function public.rls_auto_enable() to anon,authenticated;
      create event trigger fixture_auto_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable();
    `);
    await db.exec(hardening());
    await db.query('insert into auth.users(id) values($1),($2)', [owner, other]);
    await db.query('insert into public.ikari_editors(user_id) values($1)', [owner]);
    await db.query('insert into public.ikari_categories(id,name,slug) values($1,$2,$3)', ['40000000-0000-4000-8000-000000000001', 'Categoria pública', 'publica']);
    await db.query('insert into public.ikari_settings(id,value) values(1,$1::jsonb)', [JSON.stringify({ brandName: 'Fixture', email: 'public@example.test' })]);
    for (const id of media) await db.query('insert into public.ikari_media(id,filename,mime,size,width,height,alt,checksum,"storageKey") values($1,$2,$3,100,10,10,$4,$5,$6)', [id, `${id}.webp`, 'image/webp', 'Fixture', 'a'.repeat(64), `media/${id}.webp`]);
    for (let index = 0; index < projects.length; index++) {
      await db.query('insert into public.ikari_projects(id,slug,title,"coverMediaId",status) values($1,$2,$3,$4,$5)', [projects[index], `project-${index}`, `Projeto ${index}`, media[index], index === 0 ? 'published' : 'draft']);
      await db.query('insert into public.ikari_excerpts("projectId",entry,"storageKey") values($1,$2::jsonb,$3)', [projects[index], JSON.stringify({ filename: `${index + 1}.mp4`, sha256: 'a'.repeat(64) }), `excerpts/${index + 1}.mp4`]);
    }
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it('has exactly one applicable permissive SELECT policy per catalog table and application role', async () => {
    await actor('postgres');
    const result = await db.query(`select c.relname,r.rolname,count(*)::integer as n
      from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid
      cross join pg_catalog.pg_roles r
      where c.relname in ('ikari_categories','ikari_projects','ikari_media','ikari_settings','ikari_excerpts')
        and r.rolname in ('anon','authenticated') and p.polcmd in ('r','*') and p.polpermissive
        and (r.oid=any(p.polroles) or 0=any(p.polroles))
      group by c.relname,r.rolname`);
    expect(result.rows).toHaveLength(10);
    for (const row of result.rows) expect(row.n).toBe(1);
  });

  it('preserves published-only visitor and non-editor access, including public settings', async () => {
    await actor('anon');
    expect(await counts()).toEqual({ projects: 1, media: 1, excerpts: 1, categories: 1, settings: 1 });
    await actor('authenticated', other);
    expect(await counts()).toEqual({ projects: 1, media: 1, excerpts: 1, categories: 1, settings: 1 });
    const settings = await db.query("select value->>'email' as email from public.ikari_settings");
    expect(settings.rows).toEqual([{ email: 'public@example.test' }]);
    expect((await db.query("update public.ikari_projects set title='forged' returning id")).rows).toEqual([]);
    expect((await db.query('delete from public.ikari_categories returning id')).rows).toEqual([]);
    await expect(db.query("insert into public.ikari_settings(id,value) values(2,'{}')")).rejects.toMatchObject({ code: '42501' });
  });

  it('preserves owner draft/media access and separate insert/update/delete authorization', async () => {
    await actor('authenticated', owner);
    expect(await counts()).toEqual({ projects: 2, media: 3, excerpts: 2, categories: 1, settings: 1 });
    const id = '40000000-0000-4000-8000-000000000002';
    expect((await db.query('insert into public.ikari_categories(id,name,slug) values($1,$2,$3) returning id', [id, 'Fixture owner', 'owner-fixture'])).rows).toEqual([{ id }]);
    expect((await db.query('update public.ikari_categories set name=$1 where id=$2 returning name', ['Updated', id])).rows).toEqual([{ name: 'Updated' }]);
    expect((await db.query('delete from public.ikari_categories where id=$1 returning id', [id])).rows).toEqual([{ id }]);
  });

  it('removes public execute privileges without disabling the automatic RLS event trigger', async () => {
    await actor('postgres');
    expect((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon,has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated")).rows).toEqual([{ anon: false, authenticated: false }]);
    await db.exec('create table public.hardening_probe(id integer)');
    expect((await db.query("select relrowsecurity from pg_catalog.pg_class where oid='public.hardening_probe'::regclass")).rows).toEqual([{ relrowsecurity: true }]);
  });

  it('leaves inbox grants and the intentional fail-closed rate table unchanged', async () => {
    await actor('postgres');
    expect((await db.query("select has_column_privilege('authenticated','public.ikari_inquiries','payload','UPDATE') as payload_update,has_column_privilege('authenticated','public.ikari_inquiries','status','UPDATE') as status_update,has_table_privilege('anon','public.ikari_inquiries','SELECT') as anon_read")).rows)
      .toEqual([{ payload_update: false, status_update: true, anon_read: false }]);
    expect((await db.query("select relrowsecurity,(select count(*)::integer from pg_catalog.pg_policy where polrelid=c.oid) as policies from pg_catalog.pg_class c where oid='ikari_private.inquiry_limits'::regclass")).rows)
      .toEqual([{ relrowsecurity: true, policies: 0 }]);
  });

  it('can be reapplied without duplicating policies or reopening trigger execution', async () => {
    await actor('postgres');
    await db.exec(hardening());
    expect((await db.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as allowed")).rows).toEqual([{ allowed: false }]);
    await actor('authenticated', owner);
    expect(await counts()).toEqual({ projects: 2, media: 3, excerpts: 2, categories: 1, settings: 1 });
  });
});
