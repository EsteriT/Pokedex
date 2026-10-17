-- Immutable, content-addressed artwork. Reserve before upload so concurrent
-- requests cannot evade the account's 60-object (at most 30 MB) beta limit.
create table binder_private.artwork (
  path text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index artwork_owner on binder_private.artwork(owner_id);
alter table binder_private.artwork enable row level security;
alter table binder_private.catalogue enable row level security;
revoke all on binder_private.artwork from public, anon, authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('binder-artwork','binder-artwork',false,500000,array['image/png','image/jpeg','image/webp']);

create function binder_private.reserve_artwork(object_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to upload artwork.' using errcode='42501'; end if;
  perform 1 from auth.users where id=uid for update;
  if not found then raise exception 'Account unavailable.' using errcode='42501'; end if;
  if object_path is null or object_path !~ ('^'||uid::text||'/[0-9a-f]{64}\.(png|jpg|webp)$') then
    raise exception 'Invalid artwork path.' using errcode='22023'; end if;
  if exists(select 1 from binder_private.artwork where path=object_path and owner_id=uid) then return; end if;
  if (select count(*) from binder_private.artwork where owner_id=uid) >= 60 then
    raise exception 'Artwork storage is full. Remove unused artwork from Account, or download a backup.' using errcode='22023'; end if;
  insert into binder_private.artwork(path,owner_id) values(object_path,uid);
end $$;
create function public.reserve_binder_artwork(object_path text) returns void
language sql security invoker set search_path='' as $$select binder_private.reserve_artwork(object_path)$$;

create function binder_private.artwork_reserved(object_path text) returns boolean
language sql security definer stable set search_path='' as $$
  select exists(select 1 from binder_private.artwork where path=object_path and owner_id=(select auth.uid()))
$$;
create function binder_private.artwork_unused(object_path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return false; end if;
  -- Cleanup and binder commits share this lock: a referenced image cannot be
  -- deleted between document validation and the final save.
  perform 1 from auth.users where id=auth.uid() for update;
  return exists(select 1 from binder_private.artwork
    where path=object_path and owner_id=auth.uid() and created_at < now()-interval '24 hours')
    and not exists(select 1 from public.binders where owner_id=auth.uid()
      and strpos(document::text,'storage:'||object_path)>0);
end $$;
create policy "Read own reserved artwork" on storage.objects for select to authenticated
  using (bucket_id='binder-artwork' and binder_private.artwork_reserved(name));
create policy "Upload reserved artwork" on storage.objects for insert to authenticated
  with check (bucket_id='binder-artwork' and binder_private.artwork_reserved(name));
-- No UPDATE policy: files are immutable and upload never uses upsert.
create policy "Remove old unreferenced artwork" on storage.objects for delete to authenticated
  using (bucket_id='binder-artwork' and binder_private.artwork_unused(name));

create function binder_private.cleanup_artwork() returns text[]
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); candidates text[];
begin
  if uid is null then raise exception 'Sign in to manage artwork.' using errcode='42501'; end if;
  perform 1 from auth.users where id=uid for update;
  delete from binder_private.artwork a where a.owner_id=uid
    and a.created_at < now()-interval '24 hours'
    and not exists(select 1 from storage.objects o where o.bucket_id='binder-artwork' and o.name=a.path)
    and not exists(select 1 from public.binders b where b.owner_id=uid and strpos(b.document::text,'storage:'||a.path)>0);
  select coalesce(array_agg(a.path),'{}') into candidates from binder_private.artwork a
    where a.owner_id=uid and binder_private.artwork_unused(a.path);
  return candidates;
end $$;

create or replace function binder_private.image_chars(v jsonb) returns integer
language sql stable set search_path='' as $$
  select coalesce((ceil((o.metadata->>'size')::numeric / 3)*4 + 32)::integer,1800001)
  from storage.objects o where o.bucket_id='binder-artwork'
    and o.name=substring(v->>'src' from 9)
$$;
create function public.cleanup_binder_artwork() returns text[]
language sql security invoker set search_path='' as $$select binder_private.cleanup_artwork()$$;

-- Keep the crop checks from migration 1; replace only the source check.
alter function binder_private.valid_image(jsonb) rename to valid_inline_image;
create function binder_private.valid_image(v jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare image_size integer; original jsonb;
begin
  if auth.uid() is null or coalesce(v->>'src','') !~
    ('^storage:'||auth.uid()::text||'/[0-9a-f]{64}\.(png|jpg|webp)$') then return false; end if;
  select (o.metadata->>'size')::integer into image_size from storage.objects o
    join binder_private.artwork a on a.path=o.name and a.owner_id=auth.uid()
    where o.bucket_id='binder-artwork' and o.name=substring(v->>'src' from 9);
  if image_size is null or image_size not between 1 and 500000 then return false; end if;
  original:=jsonb_set(v,'{src}','"data:image/png;base64,AAAA"');
  return binder_private.valid_inline_image(original);
exception when others then return false;
end $$;

revoke all on all functions in schema binder_private from public, anon, authenticated;
grant execute on function binder_private.commit_binders(jsonb,jsonb),
  binder_private.reserve_artwork(text),binder_private.artwork_reserved(text),
  binder_private.artwork_unused(text),binder_private.cleanup_artwork() to authenticated;
revoke all on function public.reserve_binder_artwork(text),public.cleanup_binder_artwork() from public,anon;
grant execute on function public.reserve_binder_artwork(text),public.cleanup_binder_artwork() to authenticated;
