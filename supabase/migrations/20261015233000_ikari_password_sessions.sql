-- Require a recent password login in every existing owner RLS policy.
-- A previously issued magic-link token can no longer read the private inbox.
begin;
create or replace function ikari_private.is_owner() returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare claims jsonb; method jsonb; stamp numeric;
begin
  if not exists(select 1 from public.ikari_editors where user_id=(select auth.uid())) then return false; end if;
  claims := (select auth.jwt());
  if claims->>'sub' is distinct from (select auth.uid())::text or jsonb_typeof(claims->'amr') is distinct from 'array' then return false; end if;
  for method in select value from jsonb_array_elements(claims->'amr') loop
    if method->>'method'='password' and jsonb_typeof(method->'timestamp')='number' then
      stamp := (method->>'timestamp')::numeric;
      if stamp=trunc(stamp) and stamp>extract(epoch from now())-1800 and stamp<=extract(epoch from now())+30 then return true; end if;
    end if;
  end loop;
  return false;
exception when others then return false;
end;
$$;
revoke all on function ikari_private.is_owner() from public;
grant execute on function ikari_private.is_owner() to anon,authenticated,service_role;
commit;
