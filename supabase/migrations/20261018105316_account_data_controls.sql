-- Account operations serialize with existing commits on the auth.users row.
-- Deletion is deliberately resumable: Storage API first, Auth/cascades last.
create table binder_private.account_deletions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table binder_private.account_deletions enable row level security;
revoke all on binder_private.account_deletions from public, anon, authenticated;

create function binder_private.require_account(recent boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); signed_in_at timestamptz;
begin
  if uid is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  select created_at into signed_in_at from auth.sessions
    where id = nullif(auth.jwt()->>'session_id','')::uuid and user_id=uid;
  if signed_in_at is null then raise exception 'Session ended. Sign in again.' using errcode='42501'; end if;
  if recent and signed_in_at < now()-interval '10 minutes' then
    raise exception 'Sign in again before deleting your account.' using errcode='42501'; end if;
  perform 1 from auth.users where id=uid for update;
  if not found then raise exception 'Account unavailable.' using errcode='42501'; end if;
  return uid;
end $$;

create function binder_private.account_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := binder_private.require_account(); result jsonb;
begin
  select jsonb_build_object(
    'binders', coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'document',document) order by position)
      from public.binders where owner_id=uid),'[]'::jsonb),
    'collection', (select jsonb_build_object('revision',revision,'document',document) from public.collections where owner_id=uid),
    'artwork', coalesce((select jsonb_agg(name order by name) from storage.objects
      where bucket_id='binder-artwork' and name like uid::text||'/%'),'[]'::jsonb),
    'deleting', exists(select 1 from binder_private.account_deletions where owner_id=uid)
  ) into result;
  return result;
end $$;

create function binder_private.guard_account_write() returns trigger
language plpgsql set search_path='' as $$
declare uid uuid := coalesce(new.owner_id,old.owner_id);
begin
  -- Parent deletion removes the user before cascades; ordinary commits do not.
  if exists(select 1 from binder_private.account_deletions where owner_id=uid)
    and exists(select 1 from auth.users where id=uid) then
    raise exception 'Account deletion is in progress. Open Account to finish.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_deleting_binders before insert or update or delete on public.binders
  for each row execute function binder_private.guard_account_write();
create trigger protect_deleting_collection before insert or update or delete on public.collections
  for each row execute function binder_private.guard_account_write();
create trigger protect_deleting_artwork before insert or update or delete on binder_private.artwork
  for each row execute function binder_private.guard_account_write();

create function binder_private.artwork_upload_allowed(object_path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return false; end if;
  perform 1 from auth.users where id=auth.uid() for update;
  return found and not exists(select 1 from binder_private.account_deletions where owner_id=auth.uid())
    and binder_private.artwork_reserved(object_path);
end $$;
drop policy "Upload reserved artwork" on storage.objects;
create policy "Upload reserved artwork" on storage.objects for insert to authenticated
  with check (bucket_id='binder-artwork' and binder_private.artwork_upload_allowed(name));

create function binder_private.deleting_artwork(object_path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or object_path not like auth.uid()::text||'/%' then return false; end if;
  if not exists(select 1 from binder_private.account_deletions where owner_id=auth.uid()) then return false; end if;
  perform binder_private.require_account();
  return true;
end $$;
create policy "Remove own artwork during account deletion" on storage.objects for delete to authenticated
  using (bucket_id='binder-artwork' and binder_private.deleting_artwork(name));

create function binder_private.begin_account_deletion(confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := binder_private.require_account(true);
begin
  if confirmation is distinct from 'DELETE' then raise exception 'Type DELETE to confirm.' using errcode='22023'; end if;
  insert into binder_private.account_deletions(owner_id) values(uid) on conflict do nothing;
  return binder_private.account_snapshot();
end $$;
create function binder_private.finish_account_deletion(confirmation text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := binder_private.require_account(true);
begin
  if confirmation is distinct from 'DELETE' or not exists(select 1 from binder_private.account_deletions where owner_id=uid) then
    raise exception 'Confirm account deletion first.' using errcode='22023'; end if;
  if exists(select 1 from storage.objects where bucket_id='binder-artwork' and name like uid::text||'/%') then
    raise exception 'Artwork removal is incomplete. Retry deletion.' using errcode='55000'; end if;
  delete from auth.users where id=uid;
end $$;

create function binder_private.restore_account(expected jsonb, documents jsonb, expected_collection integer, collection_document jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform binder_private.require_account();
  -- A conflict in either snapshot rolls back both writes.
  perform binder_private.commit_binders(expected,documents);
  perform binder_private.commit_collection(expected_collection,collection_document);
end $$;

-- Bounded failure categories only: no card details, notes, tokens or error text.
create table binder_private.operation_counts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  category text not null check(category in ('conflict','validation','quota','network','auth','unknown')),
  count integer not null default 1 check(count between 1 and 100),
  primary key(owner_id,day,category)
);
alter table binder_private.operation_counts enable row level security;
revoke all on binder_private.operation_counts from public,anon,authenticated;
create function binder_private.report_failure(category text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or category not in ('conflict','validation','quota','network','auth','unknown') or category is null then return; end if;
  perform 1 from auth.users where id=uid for update;
  if not found then return; end if;
  delete from binder_private.operation_counts where owner_id=uid and day < current_date-7;
  insert into binder_private.operation_counts(owner_id,category) values(uid,category)
    on conflict on constraint operation_counts_pkey do update set count=least(100,binder_private.operation_counts.count+1);
end $$;

create function public.account_snapshot() returns jsonb language sql security invoker set search_path='' as $$select binder_private.account_snapshot()$$;
create function public.begin_account_deletion(confirmation text) returns jsonb language sql security invoker set search_path='' as $$select binder_private.begin_account_deletion(confirmation)$$;
create function public.finish_account_deletion(confirmation text) returns void language sql security invoker set search_path='' as $$select binder_private.finish_account_deletion(confirmation)$$;
create function public.restore_account(expected jsonb,documents jsonb,expected_collection integer,collection_document jsonb) returns void
language sql security invoker set search_path='' as $$select binder_private.restore_account(expected,documents,expected_collection,collection_document)$$;
create function public.report_account_failure(category text) returns void language sql security invoker set search_path='' as $$select binder_private.report_failure(category)$$;

revoke all on function binder_private.require_account(boolean),binder_private.guard_account_write(),
  binder_private.account_snapshot(),binder_private.artwork_upload_allowed(text),binder_private.deleting_artwork(text),
  binder_private.begin_account_deletion(text),binder_private.finish_account_deletion(text),
  binder_private.restore_account(jsonb,jsonb,integer,jsonb),binder_private.report_failure(text) from public,anon,authenticated;
grant execute on function binder_private.account_snapshot(),binder_private.artwork_upload_allowed(text),binder_private.deleting_artwork(text),
  binder_private.begin_account_deletion(text),binder_private.finish_account_deletion(text),
  binder_private.restore_account(jsonb,jsonb,integer,jsonb),binder_private.report_failure(text) to authenticated;
revoke all on function public.account_snapshot(),public.begin_account_deletion(text),public.finish_account_deletion(text),
  public.restore_account(jsonb,jsonb,integer,jsonb),public.report_account_failure(text) from public,anon;
grant execute on function public.account_snapshot(),public.begin_account_deletion(text),public.finish_account_deletion(text),
  public.restore_account(jsonb,jsonb,integer,jsonb),public.report_account_failure(text) to authenticated;
