-- Apply only to the dedicated Ikari project, after the ikari_catalog migration.
-- This is an iterative SQL artifact; remote execution/advisors precede migration capture.
begin;
create table public.ikari_inquiries (
 id uuid primary key default gen_random_uuid(),
 "requestKey" uuid not null unique,
 -- Structural envelope validation; AES-GCM authentication is checked in the server.
 payload text not null check (
  octet_length(payload) between 32 and 44000
  and payload ~ '^v1\.[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/]{22}==\.([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
  and split_part(payload,'.',4) <> ''
 ),
 status text not null default 'new' check (status in ('new','in_progress','converted','archived')),
 "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create index ikari_inquiry_order on public.ikari_inquiries("createdAt" desc, id);
create index ikari_inquiry_status_order on public.ikari_inquiries(status,"createdAt" desc,id);
alter table public.ikari_inquiries enable row level security;
revoke all on public.ikari_inquiries from public, anon, authenticated, service_role;
grant select, delete on public.ikari_inquiries to authenticated;
grant update (status,"updatedAt") on public.ikari_inquiries to authenticated;
grant select, insert on public.ikari_inquiries to service_role;
create policy ikari_inquiry_read on public.ikari_inquiries for select to authenticated using ((select ikari_private.is_owner()));
create policy ikari_inquiry_update on public.ikari_inquiries for update to authenticated using ((select ikari_private.is_owner())) with check ((select ikari_private.is_owner()));
create policy ikari_inquiry_delete on public.ikari_inquiries for delete to authenticated using ((select ikari_private.is_owner()));
create table ikari_private.inquiry_limits (
 key text primary key check (key = 'aggregate' or key ~ '^[a-f0-9]{64}$'),
 period_start timestamptz not null,
 hits integer not null check (hits between 1 and 60)
);
alter table ikari_private.inquiry_limits enable row level security;
revoke all on ikari_private.inquiry_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on ikari_private.inquiry_limits to service_role;
create or replace function public.ikari_receive_inquiry(request_key uuid, encrypted_payload text, client_key text) returns uuid
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
 if existing_id is not null then return existing_id; end if;
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
 return existing_id;
end $$;
revoke all on function public.ikari_receive_inquiry(uuid,text,text) from public, anon, authenticated;
grant execute on function public.ikari_receive_inquiry(uuid,text,text) to service_role;
commit;
