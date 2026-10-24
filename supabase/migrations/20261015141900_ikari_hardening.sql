-- Proposed follow-up to catalog.sql and inbox.sql; not applied by this artifact.
-- Addresses advisor permissions/policy overlap without changing public content.
-- Run as the trusted migration administrator, then rerun security/performance advisors.
-- JWT verification/expiry belongs to Auth/PostgREST. These policies enforce the
-- editor allowlist; they do not promise instant revocation of issued access JWTs.
begin;

-- A platform event trigger does not need a public RPC execution grant. Preserve
-- its definition, owner, event registration and automatic RLS behavior.
do $trigger_acl$
begin
 if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
 end if;
end
$trigger_acl$;

-- Categories and settings are intentionally public to visitors and signed-in users.
drop policy if exists ikari_category_read on public.ikari_categories;
create policy ikari_category_read on public.ikari_categories for select to anon, authenticated using (true);
drop policy if exists ikari_settings_read on public.ikari_settings;
create policy ikari_settings_read on public.ikari_settings for select to anon, authenticated using (true);

-- One SELECT policy per role. Visitors and non-editors see published projects;
-- only allowlisted editors can also select drafts or unused/private media.
drop policy if exists ikari_project_read on public.ikari_projects;
drop policy if exists ikari_project_editor_read on public.ikari_projects;
create policy ikari_project_read on public.ikari_projects for select to anon using (status = 'published');
create policy ikari_project_editor_read on public.ikari_projects for select to authenticated
 using (status = 'published' or (select ikari_private.is_owner()));

drop policy if exists ikari_media_read on public.ikari_media;
drop policy if exists ikari_media_editor_read on public.ikari_media;
create policy ikari_media_read on public.ikari_media for select to anon
 using (exists (select 1 from public.ikari_projects p where p."coverMediaId" = ikari_media.id and p.status = 'published'));
create policy ikari_media_editor_read on public.ikari_media for select to authenticated
 using ((select ikari_private.is_owner()) or exists (select 1 from public.ikari_projects p where p."coverMediaId" = ikari_media.id and p.status = 'published'));

drop policy if exists ikari_excerpt_read on public.ikari_excerpts;
drop policy if exists ikari_excerpt_editor_read on public.ikari_excerpts;
create policy ikari_excerpt_read on public.ikari_excerpts for select to anon
 using (exists (select 1 from public.ikari_projects p where p.id = ikari_excerpts."projectId" and p.status = 'published'));
create policy ikari_excerpt_editor_read on public.ikari_excerpts for select to authenticated
 using ((select ikari_private.is_owner()) or exists (select 1 from public.ikari_projects p where p.id = ikari_excerpts."projectId" and p.status = 'published'));

-- Replace only the five known FOR ALL policies with explicit owner mutations.
-- Every identifier comes from this fixed list, not application/user input.
do $mutation_policies$
declare target record;
begin
 for target in select * from (values
  ('ikari_categories','ikari_category'),
  ('ikari_projects','ikari_project'),
  ('ikari_media','ikari_media'),
  ('ikari_settings','ikari_settings'),
  ('ikari_excerpts','ikari_excerpt')
 ) as targets(table_name,policy_prefix) loop
  execute pg_catalog.format('drop policy if exists %I on public.%I', target.policy_prefix || '_owner', target.table_name);
  execute pg_catalog.format('drop policy if exists %I on public.%I', target.policy_prefix || '_insert', target.table_name);
  execute pg_catalog.format('drop policy if exists %I on public.%I', target.policy_prefix || '_update', target.table_name);
  execute pg_catalog.format('drop policy if exists %I on public.%I', target.policy_prefix || '_delete', target.table_name);
  execute pg_catalog.format(
   'create policy %I on public.%I for insert to authenticated with check ((select ikari_private.is_owner()))',
   target.policy_prefix || '_insert', target.table_name
  );
  execute pg_catalog.format(
   'create policy %I on public.%I for update to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()))',
   target.policy_prefix || '_update', target.table_name
  );
  execute pg_catalog.format(
   'create policy %I on public.%I for delete to authenticated using ((select ikari_private.is_owner()))',
   target.policy_prefix || '_delete', target.table_name
  );
 end loop;
end
$mutation_policies$;

-- Inbox/limits schema, RLS, grants, encryption and rate RPC remain untouched.
-- In particular, inquiry_limits has no client policy by design: service_role
-- performs the guarded RPC; anon/authenticated must continue to fail closed.
commit;

-- Recovery: retain the prior catalog policy definitions before applying. If a
-- regression is confirmed, restore only those policies in a reviewed transaction;
-- do not rerun catalog.sql (CREATE TABLE) or reopen public trigger execution.
