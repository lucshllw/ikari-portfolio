-- Local artifact only. Apply to the dedicated Ikari Supabase project.
-- Editors are provisioned by a trusted administrator, never by signup metadata.
begin;
create schema if not exists ikari_private;
revoke all on schema ikari_private from public;
grant usage on schema ikari_private to anon, authenticated, service_role;

create table if not exists public.ikari_editors (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.ikari_editors enable row level security;
revoke all on public.ikari_editors from anon, authenticated;
grant select on public.ikari_editors to authenticated;
grant all on public.ikari_editors to service_role;
create policy ikari_editor_self on public.ikari_editors for select to authenticated using (user_id = (select auth.uid()));

-- Definer needed only for the allowlist lookup used by RLS. It has no arguments,
-- no dynamic SQL and an empty search_path; no client may modify the allowlist.
create or replace function ikari_private.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.ikari_editors where user_id = (select auth.uid())) $$;
revoke all on function ikari_private.is_owner() from public;
grant execute on function ikari_private.is_owner() to anon, authenticated, service_role;

create table public.ikari_categories (
  id uuid primary key,
  name text not null check (length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  "sortOrder" integer not null default 0 check ("sortOrder" between 0 and 10000)
);
create table public.ikari_media (
  id uuid primary key,
  filename text not null,
  mime text not null check (mime = 'image/webp'),
  size integer not null check (size > 0),
  width integer not null check (width between 1 and 1800),
  height integer not null check (height between 1 and 1800),
  alt text not null check (length(alt) <= 300),
  "createdAt" timestamptz not null default now(),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  "storageKey" text not null unique,
  "originalKey" text,
  check (filename = id::text || '.webp'),
  check ("storageKey" = 'media/' || id::text || '.webp'),
  check ("originalKey" is null or "originalKey" in ('originals/' || id::text || '.jpg', 'originals/' || id::text || '.png', 'originals/' || id::text || '.webp'))
);
create table public.ikari_projects (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title text not null check (length(title) between 1 and 160),
  summary text not null default '' check (length(summary) <= 500),
  description text not null default '' check (length(description) <= 10000),
  "categoryId" uuid references public.ikari_categories(id) on delete restrict,
  "coverMediaId" uuid references public.ikari_media(id) on delete restrict,
  "coverUrl" text not null default '' check (length("coverUrl") <= 250),
  "coverAlt" text not null default '' check (length("coverAlt") <= 300),
  "videoUrl" text not null default '' check (length("videoUrl") <= 500),
  "sourceUrl" text not null default '' check (length("sourceUrl") <= 2048),
  featured boolean not null default false,
  "sortOrder" integer not null default 0 check ("sortOrder" between 0 and 10000),
  status text not null check (status in ('draft', 'published')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index ikari_project_public_order on public.ikari_projects(status, "sortOrder", "createdAt" desc, id);
create index ikari_project_category on public.ikari_projects("categoryId");
create index ikari_project_media on public.ikari_projects("coverMediaId");
create table public.ikari_settings (
  id integer primary key check (id = 1),
  value jsonb not null check (jsonb_typeof(value) = 'object')
);
create table public.ikari_excerpts (
  "projectId" uuid primary key references public.ikari_projects(id) on delete cascade,
  entry jsonb not null check (jsonb_typeof(entry) = 'object'),
  "storageKey" text not null,
  check (entry->>'filename' ~ '^[1-9][0-9]{0,24}\.mp4$'),
  check ("storageKey" = 'excerpts/' || (entry->>'filename')),
  check (entry->>'sha256' ~ '^[a-f0-9]{64}$')
);

alter table public.ikari_categories enable row level security;
alter table public.ikari_media enable row level security;
alter table public.ikari_projects enable row level security;
alter table public.ikari_settings enable row level security;
alter table public.ikari_excerpts enable row level security;
revoke all on public.ikari_categories, public.ikari_media, public.ikari_projects, public.ikari_settings, public.ikari_excerpts from anon, authenticated;
grant select on public.ikari_categories, public.ikari_media, public.ikari_projects, public.ikari_settings, public.ikari_excerpts to anon, authenticated;
grant insert, update, delete on public.ikari_categories, public.ikari_media, public.ikari_projects, public.ikari_settings, public.ikari_excerpts to authenticated;
grant all on public.ikari_categories, public.ikari_media, public.ikari_projects, public.ikari_settings, public.ikari_excerpts to service_role;
create policy ikari_category_read on public.ikari_categories for select to anon, authenticated using (true);
create policy ikari_category_owner on public.ikari_categories for all to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));
create policy ikari_project_read on public.ikari_projects for select to anon, authenticated using (status = 'published');
create policy ikari_project_owner on public.ikari_projects for all to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));
create policy ikari_settings_read on public.ikari_settings for select to anon, authenticated using (true);
create policy ikari_settings_owner on public.ikari_settings for all to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));
create policy ikari_media_read on public.ikari_media for select to anon, authenticated using (exists (select 1 from public.ikari_projects p where p."coverMediaId" = ikari_media.id and p.status = 'published'));
create policy ikari_media_owner on public.ikari_media for all to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));
create policy ikari_excerpt_read on public.ikari_excerpts for select to anon, authenticated using (exists (select 1 from public.ikari_projects p where p.id = ikari_excerpts."projectId" and p.status = 'published'));
create policy ikari_excerpt_owner on public.ikari_excerpts for all to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));

-- Reordering must be atomic even when two admin requests overlap. Only the
-- service role can execute; the server has already verified the session actor.
create or replace function public.ikari_move_project(project_id uuid, move_direction integer, actor_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare ordered_ids uuid[]; current_position integer; target_position integer; temp_id uuid;
begin
  if not exists (select 1 from public.ikari_editors where user_id = actor_id) then raise exception 'Forbidden'; end if;
  if move_direction not in (-1, 1) then raise exception 'Invalid direction'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1749823462);
  select array_agg(id order by "sortOrder", "createdAt" desc, id) into ordered_ids from public.ikari_projects;
  current_position := array_position(ordered_ids, project_id);
  if current_position is null then raise exception 'Project not found'; end if;
  target_position := current_position + move_direction;
  if target_position < 1 or target_position > array_length(ordered_ids, 1) then return; end if;
  temp_id := ordered_ids[target_position];
  ordered_ids[target_position] := project_id;
  ordered_ids[current_position] := temp_id;
  update public.ikari_projects p set "sortOrder" = (u.ordinality - 1)::integer, "updatedAt" = now()
    from unnest(ordered_ids) with ordinality as u(id, ordinality) where p.id = u.id;
end;
$$;
revoke all on function public.ikari_move_project(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.ikari_move_project(uuid, integer, uuid) to service_role;

-- Used only by the manually invoked importer, after verifying asset checksums.
-- One RPC is one transaction: projects and their excerpt metadata appear together.
-- Upserts retain existing unrelated CMS rows and preserve IDs on repeated imports.
create or replace function public.ikari_import_catalog(batch jsonb) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  if batch->>'version' is distinct from '1' then raise exception 'Invalid catalog version'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1749823462);
  insert into public.ikari_categories (id,name,slug,"sortOrder")
    select id,name,slug,"sortOrder" from jsonb_populate_recordset(null::public.ikari_categories,batch->'categories')
    on conflict (id) do update set name=excluded.name,slug=excluded.slug,"sortOrder"=excluded."sortOrder";
  insert into public.ikari_media (id,filename,mime,size,width,height,alt,"createdAt",checksum,"storageKey","originalKey")
    select id,filename,mime,size,width,height,alt,"createdAt",checksum,"storageKey","originalKey" from jsonb_populate_recordset(null::public.ikari_media,batch->'media')
    on conflict (id) do update set filename=excluded.filename,mime=excluded.mime,size=excluded.size,width=excluded.width,height=excluded.height,alt=excluded.alt,"createdAt"=excluded."createdAt",checksum=excluded.checksum,"storageKey"=excluded."storageKey","originalKey"=excluded."originalKey";
  insert into public.ikari_projects (id,slug,title,summary,description,"categoryId","coverMediaId","coverUrl","coverAlt","videoUrl","sourceUrl",featured,"sortOrder",status,"createdAt","updatedAt")
    select id,slug,title,summary,description,"categoryId","coverMediaId","coverUrl","coverAlt","videoUrl","sourceUrl",featured,"sortOrder",status,"createdAt","updatedAt" from jsonb_populate_recordset(null::public.ikari_projects,batch->'projects')
    on conflict (id) do update set slug=excluded.slug,title=excluded.title,summary=excluded.summary,description=excluded.description,"categoryId"=excluded."categoryId","coverMediaId"=excluded."coverMediaId","coverUrl"=excluded."coverUrl","coverAlt"=excluded."coverAlt","videoUrl"=excluded."videoUrl","sourceUrl"=excluded."sourceUrl",featured=excluded.featured,"sortOrder"=excluded."sortOrder",status=excluded.status,"createdAt"=excluded."createdAt","updatedAt"=excluded."updatedAt";
  insert into public.ikari_settings (id,value) values (1,batch->'settings')
    on conflict (id) do update set value=excluded.value;
  insert into public.ikari_excerpts ("projectId",entry,"storageKey")
    select "projectId",entry,"storageKey" from jsonb_populate_recordset(null::public.ikari_excerpts,batch->'excerpts')
    on conflict ("projectId") do update set entry=excluded.entry,"storageKey"=excluded."storageKey";
  return jsonb_build_object('projects',jsonb_array_length(batch->'projects'),'categories',jsonb_array_length(batch->'categories'),'media',jsonb_array_length(batch->'media'),'excerpts',jsonb_array_length(batch->'excerpts'));
end;
$$;
revoke all on function public.ikari_import_catalog(jsonb) from public, anon, authenticated;
grant execute on function public.ikari_import_catalog(jsonb) to service_role;

-- No anonymous Storage policy. Public media is served through visibility-checked
-- application routes, so unpublishing a project revokes subsequent access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ikari-media', 'ikari-media', false, 50000000, array['image/jpeg','image/png','image/webp','video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Staging has a hard 12MiB Storage limit; only signed-upload capabilities issued
-- by the authenticated server can write here. No direct client CRUD policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ikari-uploads', 'ikari-uploads', false, 12582912, array['image/jpeg','image/png','image/webp','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy ikari_storage_owner_select on storage.objects for select to authenticated using (bucket_id = 'ikari-media' and (select ikari_private.is_owner()));
create policy ikari_storage_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'ikari-media' and (select ikari_private.is_owner()));
create policy ikari_storage_owner_update on storage.objects for update to authenticated using (bucket_id = 'ikari-media' and (select ikari_private.is_owner())) with check (bucket_id = 'ikari-media' and (select ikari_private.is_owner()));
create policy ikari_storage_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'ikari-media' and (select ikari_private.is_owner()));
commit;
