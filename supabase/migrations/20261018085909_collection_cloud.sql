-- One bounded snapshot matches manual collection Save and provides atomic conflicts.
-- The owner primary key also indexes every RLS lookup. Browser roles may only read.
create table public.collections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create policy "Read own collection" on public.collections for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.collections from public, anon, authenticated;
grant select on public.collections to authenticated;

create function binder_private.valid_collection(document jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare r jsonb; groups jsonb; grading jsonb;
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if jsonb_typeof(document) is distinct from 'object'
    or document - 'records' <> '{}'::jsonb
    or jsonb_typeof(document->'records') is distinct from 'array' then return false; end if;
  if jsonb_array_length(document->'records') > 5000
    or octet_length(document::text) > 16777216 then return false; end if;
  for r in select value from jsonb_array_elements(document->'records') loop
    if jsonb_typeof(r) is distinct from 'object'
      or not (r ?& array['id','kind','cardId','finish','quantity','condition','grading','notes','chase','tradeStatus'])
      or r - array['id','kind','cardId','finish','quantity','condition','grading','notes','chase','tradeStatus'] <> '{}'::jsonb
      then return false; end if;
    if jsonb_typeof(r->'id') is distinct from 'string' or (r->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$'
      or jsonb_typeof(r->'cardId') is distinct from 'string'
      or (r->>'kind') not in ('owned','wanted') or jsonb_typeof(r->'kind') is distinct from 'string'
      or jsonb_typeof(r->'finish') is distinct from 'string'
      or jsonb_typeof(r->'quantity') is distinct from 'number' or (r->>'quantity') !~ '^[1-9][0-9]{0,2}$'
      or jsonb_typeof(r->'condition') is distinct from 'string' or (r->>'condition') not in ('unknown','nm','lp','mp','hp','damaged')
      or jsonb_typeof(r->'tradeStatus') is distinct from 'string' or (r->>'tradeStatus') not in ('keep','trade','sale')
      or jsonb_typeof(r->'notes') is distinct from 'string'
      or jsonb_typeof(r->'chase') is distinct from 'boolean' then return false; end if;
    -- JavaScript counts astral characters as two UTF-16 units; match its limits.
    if length(regexp_replace(r->>'notes', U&'[\+010000-\+10FFFF]', 'xx', 'g')) > 2000 then return false; end if;
    if not exists(select 1 from binder_private.catalogue c where c.card_id = r->>'cardId'
      and ((r->>'finish') = 'unknown' or c.variants->(r->>'finish') = 'true'::jsonb)) then return false; end if;
    grading := r->'grading';
    if grading <> 'null'::jsonb then
      if jsonb_typeof(grading) is distinct from 'object'
        or not (grading ?& array['company','grade']) or grading - array['company','grade'] <> '{}'::jsonb
        or (grading->>'company') not in ('PSA','BGS','CGC','Other')
        or jsonb_typeof(grading->'company') is distinct from 'string'
        or jsonb_typeof(grading->'grade') is distinct from 'string'
        or btrim(grading->>'grade', trim_chars) = ''
        or grading->>'grade' <> btrim(grading->>'grade', trim_chars)
        or length(regexp_replace(grading->>'grade', U&'[\+010000-\+10FFFF]', 'xx', 'g')) > 20 then return false; end if;
    end if;
    if (r->>'kind') = 'wanted' and (grading <> 'null'::jsonb or r->>'condition' <> 'unknown' or r->>'tradeStatus' <> 'keep')
      or (r->>'kind') = 'owned' and (r->'chase' <> 'false'::jsonb or grading <> 'null'::jsonb and r->>'condition' <> 'unknown')
      then return false; end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(document->'records')) <> jsonb_array_length(document->'records') then return false; end if;
  select jsonb_agg(jsonb_build_array(value->>'kind',value->>'cardId',value->>'finish',
    case when value->>'kind'='owned' then value->>'condition' else '' end,
    coalesce(value->'grading'->>'company',''),coalesce(value->'grading'->>'grade','')))
    into groups from jsonb_array_elements(document->'records');
  if (select count(distinct value) from jsonb_array_elements(coalesce(groups,'[]'::jsonb))) <> jsonb_array_length(document->'records') then return false; end if;
  return true;
end $$;

-- As with binders, only this private checked function can write. No owner argument.
create function binder_private.commit_collection(expected_revision integer, document jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); actual integer; next_revision integer;
begin
  if uid is null then raise exception 'Sign in to save your collection.' using errcode = '42501'; end if;
  if not binder_private.valid_collection(document) then
    raise exception 'Invalid collection. Maximum 5,000 groups and 16 MB; check printing, finish, quantities and details.' using errcode = '22023'; end if;
  -- Lock only after validation; this also serializes two simultaneous first saves.
  perform 1 from auth.users where id = uid for update;
  if not found then raise exception 'Account unavailable.' using errcode = '42501'; end if;
  select c.revision into actual from public.collections c where c.owner_id = uid;
  if actual is distinct from expected_revision then
    raise exception 'Collection changed on another device. Your draft has not been overwritten.' using errcode = '40001'; end if;
  next_revision := coalesce(actual,0) + 1;
  insert into public.collections(owner_id,document,revision) values(uid,document,next_revision)
    on conflict(owner_id) do update set document = excluded.document, revision = excluded.revision, updated_at = now();
  return next_revision;
end $$;
create function public.commit_collection(expected_revision integer, document jsonb) returns integer
language sql security invoker set search_path = '' as $$
  select binder_private.commit_collection(expected_revision, document)
$$;
revoke all on function binder_private.valid_collection(jsonb) from public, anon, authenticated;
revoke all on function binder_private.commit_collection(integer,jsonb) from public, anon, authenticated;
grant execute on function binder_private.commit_collection(integer,jsonb) to authenticated;
revoke all on function public.commit_collection(integer,jsonb) from public, anon, authenticated;
grant execute on function public.commit_collection(integer,jsonb) to authenticated;
