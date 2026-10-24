-- One-time credential proof. No visitor/editor role can mint, read or consume tickets.
-- Apply to the dedicated Ikari database before enabling the recovery gate.
begin;
create table if not exists ikari_private.password_recovery_tickets (
 ticket_hash text primary key check (ticket_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 expires_at timestamptz not null,
 unique(user_id, session_id)
);
alter table ikari_private.password_recovery_tickets enable row level security;
revoke all on ikari_private.password_recovery_tickets from public, anon, authenticated, service_role;
grant select, insert, update, delete on ikari_private.password_recovery_tickets to service_role;

create or replace function public.ikari_issue_password_recovery(ticket_digest text, owner_uuid uuid, auth_session uuid, valid_until timestamptz) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 if ticket_digest !~ '^[a-f0-9]{64}$' or owner_uuid is null or auth_session is null or valid_until is null
  or valid_until <= clock_timestamp() or valid_until > clock_timestamp()+interval '11 minutes'
  or not exists(select 1 from public.ikari_editors where user_id=owner_uuid) then return false; end if;
 delete from ikari_private.password_recovery_tickets where expires_at <= clock_timestamp();
 insert into ikari_private.password_recovery_tickets(ticket_hash,user_id,session_id,expires_at)
 values(ticket_digest,owner_uuid,auth_session,valid_until)
 on conflict(user_id,session_id) do update set ticket_hash=excluded.ticket_hash,expires_at=excluded.expires_at;
 return true;
end $$;
create or replace function public.ikari_check_password_recovery(ticket_digest text, owner_uuid uuid, auth_session uuid) returns boolean
language sql security invoker set search_path = '' as $$
 select exists(select 1 from ikari_private.password_recovery_tickets
 where ticket_hash=ticket_digest and user_id=owner_uuid and session_id=auth_session and expires_at>clock_timestamp());
$$;
create or replace function public.ikari_consume_password_recovery(ticket_digest text, owner_uuid uuid, auth_session uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare consumed text;
begin
 delete from ikari_private.password_recovery_tickets where ticket_hash=ticket_digest and user_id=owner_uuid and session_id=auth_session and expires_at>clock_timestamp()
 returning ticket_hash into consumed;
 return consumed is not null;
end $$;
revoke all on function public.ikari_issue_password_recovery(text,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.ikari_check_password_recovery(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.ikari_consume_password_recovery(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ikari_issue_password_recovery(text,uuid,uuid,timestamptz) to service_role;
grant execute on function public.ikari_check_password_recovery(text,uuid,uuid) to service_role;
grant execute on function public.ikari_consume_password_recovery(text,uuid,uuid) to service_role;
commit;
