-- Proposed v13 patch for dedicated Ikari Supabase project only.
-- Not applied by this file. Execute/advisor validation and migration capture are separate steps.
-- Forward-compatible schema addition. v12 is NOT a safe application rollback after v13 writes:
-- its strict four-field envelope and status enum reject notes/referenceId/completed.
-- Keep v13 readers when restoring code, or prepare an explicit data migration after backup.
-- Never drop notes, reclassify converted/completed, or remove these columns as an automatic rollback.
begin;
alter table public.ikari_inquiries add column if not exists priority text not null default 'normal';
alter table public.ikari_inquiries add column if not exists "deletedAt" timestamptz;
alter table public.ikari_inquiries drop constraint if exists ikari_inquiries_status_check;
alter table public.ikari_inquiries add constraint ikari_inquiries_status_check check (status in ('new','review','in_progress','converted','completed','archived'));
do $$ begin
 if not exists(select 1 from pg_constraint where conname='ikari_inquiries_priority_check' and conrelid='public.ikari_inquiries'::regclass) then
  alter table public.ikari_inquiries add constraint ikari_inquiries_priority_check check(priority in ('normal','urgent','planning'));
 end if;
end $$;
-- Owner policies retain both USING and WITH CHECK. Internal notes remain encrypted in payload.
grant update (payload,priority,"deletedAt") on public.ikari_inquiries to authenticated;
-- Remove hard-delete capability. Application now soft-deletes and preserves the original record.
revoke delete on public.ikari_inquiries from authenticated;
drop policy if exists ikari_inquiry_delete on public.ikari_inquiries;
create index if not exists ikari_inquiry_active_order on public.ikari_inquiries("createdAt" desc,id) where "deletedAt" is null;
alter table public.ikari_inquiries add column if not exists "quoteCents" bigint not null default 0 check ("quoteCents" between 0 and 100000000);
grant update ("quoteCents") on public.ikari_inquiries to authenticated;
create or replace function public.ikari_studio_revenue() returns bigint language sql stable security invoker set search_path='' as $$
 select coalesce(sum("quoteCents"),0)::bigint from public.ikari_inquiries where "deletedAt" is null and status='completed' and (select ikari_private.is_owner());
$$;
revoke all on function public.ikari_studio_revenue() from public,anon;grant execute on function public.ikari_studio_revenue() to authenticated;
create or replace function public.ikari_studio_import(records jsonb,dry_run boolean default true) returns jsonb language plpgsql security invoker set search_path='' as $$
declare entry jsonb;added integer:=0;skipped integer:=0; row_count integer;
begin
 if not (select ikari_private.is_owner()) then raise exception 'Forbidden'; end if;
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>500 or octet_length(records::text)>24000000 then raise exception 'Invalid archive';end if;
 for entry in select value from jsonb_array_elements(records) loop
  if exists(select 1 from public.ikari_inquiries where id=(entry->>'id')::uuid or "requestKey"=(entry->>'requestKey')::uuid) then skipped:=skipped+1;continue;end if;
  if dry_run then added:=added+1;continue;end if;
  insert into public.ikari_inquiries(id,"requestKey",payload,status,priority,"quoteCents","createdAt","updatedAt") values((entry->>'id')::uuid,(entry->>'requestKey')::uuid,entry->>'payload',entry->>'status',entry->>'priority',(entry->>'quoteCents')::bigint,(entry->>'createdAt')::timestamptz,(entry->>'updatedAt')::timestamptz) on conflict do nothing;
  get diagnostics row_count=ROW_COUNT; if row_count=1 then added:=added+1;else skipped:=skipped+1;end if;
 end loop;
 return jsonb_build_object('added',added,'skipped',skipped,'dryRun',dry_run);
end $$;
grant insert (id,"requestKey",payload,status,priority,"quoteCents","createdAt","updatedAt") on public.ikari_inquiries to authenticated;
drop policy if exists ikari_inquiry_manual_insert on public.ikari_inquiries;
create policy ikari_inquiry_manual_insert on public.ikari_inquiries for insert to authenticated with check((select ikari_private.is_owner()));
revoke all on function public.ikari_studio_import(jsonb,boolean) from public,anon;grant execute on function public.ikari_studio_import(jsonb,boolean) to authenticated;
commit;

create or replace function public.ikari_receive_inquiry_v14(request_key uuid, encrypted_payload text, client_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare existing_id uuid; current_period_start timestamptz; entry record; limit_key text; max_hits integer;
begin
 if request_key is null then raise exception 'Invalid request'; end if;
 if client_key is null or client_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid client'; end if;
 if encrypted_payload is null or octet_length(encrypted_payload) not between 32 and 44000
  or encrypted_payload !~ '^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]{22}==\.([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
  or split_part(encrypted_payload,'.',4) = '' then raise exception 'Invalid envelope'; end if;
 -- Serializes idempotency and both rate limits across all function instances.
 perform pg_catalog.pg_advisory_xact_lock(1749823463);
 select id into existing_id from public.ikari_inquiries where "requestKey" = request_key;
 if existing_id is not null then return jsonb_build_object('id',existing_id,'created',false); end if;
 -- Compute after waiting for the lock, so queued requests cannot roll a window back.
 current_period_start := date_trunc('minute', clock_timestamp());
 delete from ikari_private.inquiry_limits where period_start < current_period_start - interval '2 minutes';
 foreach limit_key in array array['aggregate', client_key] loop
  max_hits := case when limit_key = 'aggregate' then 60 else 6 end;
  select * into entry from ikari_private.inquiry_limits where key = limit_key;
  if found and entry.period_start = current_period_start and entry.hits >= max_hits then raise exception 'Rate limited'; end if;
  insert into ikari_private.inquiry_limits(key,period_start,hits) values(limit_key,current_period_start,1)
  on conflict(key) do update set period_start = excluded.period_start, hits = case when inquiry_limits.period_start = excluded.period_start then inquiry_limits.hits + 1 else 1 end;
 end loop;
 insert into public.ikari_inquiries("requestKey",payload) values(request_key,encrypted_payload) returning id into existing_id;
 return jsonb_build_object('id',existing_id,'created',true);
end $$;

revoke all on function public.ikari_receive_inquiry_v14(uuid,text,text) from public,anon,authenticated; grant execute on function public.ikari_receive_inquiry_v14(uuid,text,text) to service_role;
