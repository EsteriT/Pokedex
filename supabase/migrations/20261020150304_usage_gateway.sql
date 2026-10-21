-- Staged rollout: origin lockdown starts only after private configuration.
create table binder_private.usage_gateway (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  secret_digest bytea,
  check (not enabled or (secret_digest is not null and octet_length(secret_digest)=32))
);
insert into binder_private.usage_gateway(id) values(true);
alter table binder_private.usage_gateway enable row level security;
revoke all on binder_private.usage_gateway from public,anon,authenticated;

create function binder_private.gateway_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare settings binder_private.usage_gateway; supplied text;
begin
  select * into settings from binder_private.usage_gateway where id;
  if not found then return false; end if;
  if not settings.enabled then return true; end if;
  supplied := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-pokedex-gateway';
  return coalesce(length(supplied)=64 and sha256(convert_to(supplied,'UTF8'))=settings.secret_digest,false);
end $$;
revoke all on function binder_private.gateway_allowed() from public,anon,authenticated;
grant execute on function binder_private.gateway_allowed() to authenticated;

create function public.require_usage_gateway() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.jwt()->>'role'='service_role' then return; end if;
  if not binder_private.gateway_allowed() then
    raise exception 'Use the application gateway.' using errcode='42501';
  end if;
end $$;
revoke all on function public.require_usage_gateway() from public;
grant execute on function public.require_usage_gateway() to anon,authenticated;

create policy "Gateway required for binder reads" on public.binders
  as restrictive for select to authenticated using ((select binder_private.gateway_allowed()));
create policy "Gateway required for collection reads" on public.collections
  as restrictive for select to authenticated using ((select binder_private.gateway_allowed()));
create policy "Gateway required for artwork" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id<>'binder-artwork' or (select binder_private.gateway_allowed()))
  with check (bucket_id<>'binder-artwork' or (select binder_private.gateway_allowed()));

-- At most seven rows per account; two public rows, with no per-request log.
create table binder_private.usage_buckets (
  actor text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  bucket text not null check(bucket in ('public','read','write','artwork','account','deletion','telemetry','bytes')),
  tokens numeric not null check(tokens>=0),
  updated_at timestamptz not null,
  primary key(actor,bucket),
  check(actor=coalesce(owner_id::text,'public'))
);
alter table binder_private.usage_buckets enable row level security;
revoke all on binder_private.usage_buckets from public,anon,authenticated;

create function public.admit_usage(category text, byte_cost bigint) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='1s' as $$
declare
  uid uuid := auth.uid(); actor_key text; settings binder_private.usage_gateway;
  supplied text; capacity numeric; byte_capacity numeric; available numeric;
  bytes_available numeric; stamp timestamptz; wait_seconds integer;
begin
  -- Internal calls always require the private secret, even before lockdown.
  select * into settings from binder_private.usage_gateway where id;
  supplied := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-pokedex-gateway';
  if settings.secret_digest is null or length(coalesce(supplied,''))<>64
    or sha256(convert_to(supplied,'UTF8'))<>settings.secret_digest then
    raise exception 'Gateway admission unavailable.' using errcode='42501';
  end if;
  if category is null or category not in ('public','read','write','artwork','account','deletion','telemetry')
    or byte_cost is null or byte_cost not between 0 and 67108864 then
    raise exception 'Invalid usage category.' using errcode='22023';
  end if;
  if category='public' then uid:=null;
  elsif uid is null or not exists(select 1 from auth.users where id=uid) then
    raise exception 'Sign in first.' using errcode='42501';
  end if;
  actor_key:=coalesce(uid::text,'public');
  capacity:=case category when 'public' then 600 when 'read' then 120 when 'write' then 30
    when 'artwork' then 240 when 'account' then 10 when 'deletion' then 10 when 'telemetry' then 20 end;
  byte_capacity:=case when uid is null then 67108864 else 268435456 end;
  perform pg_advisory_xact_lock(hashtextextended('usage:'||actor_key,0));
  stamp:=clock_timestamp();
  insert into binder_private.usage_buckets(actor,owner_id,bucket,tokens,updated_at)
    values(actor_key,uid,category,capacity,stamp),(actor_key,uid,'bytes',byte_capacity,stamp)
    on conflict do nothing;
  select least(capacity,tokens+greatest(0,extract(epoch from stamp-updated_at))*capacity/60)
    into available from binder_private.usage_buckets where actor=actor_key and bucket=category;
  select least(byte_capacity,tokens+greatest(0,extract(epoch from stamp-updated_at))*byte_capacity/60)
    into bytes_available from binder_private.usage_buckets where actor=actor_key and bucket='bytes';
  if available<1 or bytes_available<byte_cost then
    wait_seconds:=greatest(1,ceil(greatest((1-available)*60/capacity,
      (byte_cost-bytes_available)*60/byte_capacity))::integer);
    return jsonb_build_object('allowed',false,'retry_after',wait_seconds);
  end if;
  update binder_private.usage_buckets set tokens=available-1,updated_at=stamp
    where actor=actor_key and bucket=category;
  update binder_private.usage_buckets set tokens=bytes_available-byte_cost,updated_at=stamp
    where actor=actor_key and bucket='bytes';
  return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.admit_usage(text,bigint) from public;
grant execute on function public.admit_usage(text,bigint) to anon,authenticated;

do $$
declare existing text;
begin
  if exists(select 1 from pg_roles where rolname='authenticator') then
    select substring(setting from length('pgrst.db_pre_request=')+1) into existing
      from pg_roles r,unnest(r.rolconfig) setting
      where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
    if existing is not null and existing<>'public.require_usage_gateway' then
      raise exception 'Review the existing pre-request hook before installing the usage gateway.';
    end if;
    alter role authenticator set pgrst.db_pre_request='public.require_usage_gateway';
  end if;
end $$;
notify pgrst,'reload config';
