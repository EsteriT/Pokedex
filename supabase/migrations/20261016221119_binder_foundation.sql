-- Private binder documents. Browser clients may read their own records, but
-- writes go through one atomic, revision-checked transaction.
create schema if not exists binder_private;
revoke all on schema binder_private from public;
grant usage on schema binder_private to authenticated;

create table binder_private.catalogue (
  card_id text primary key,
  variants jsonb
);
revoke all on binder_private.catalogue from public, anon, authenticated;

create function binder_private.valid_frames(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(v) = 'object'
    and v->>'sleeve' in ('none','poke','great','ultra','master','premier')
    and v->>'toploader' in ('none','clear','poke','great','ultra','master','premier'), false)
$$;

create function binder_private.valid_image(v jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce(jsonb_typeof(v) = 'object'
    and jsonb_typeof(v->'src') = 'string'
    and v->>'src' ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
    and length(v->>'src') <= 650000
    and jsonb_typeof(v->'name') = 'string' and length(v->>'name') <= 100
    and (v->>'width')::numeric between 1 and 1600
    and (v->>'height')::numeric between 1 and 1600
    and (v->>'width')::numeric = trunc((v->>'width')::numeric)
    and (v->>'height')::numeric = trunc((v->>'height')::numeric)
    and v->>'fit' in ('cover','contain')
    and (v->>'zoom')::numeric between 1 and 2
    and (v->>'x')::numeric between 0 and 100
    and (v->>'y')::numeric between 0 and 100
    and jsonb_typeof(v->'width') = 'number' and jsonb_typeof(v->'height') = 'number'
    and jsonb_typeof(v->'zoom') = 'number' and jsonb_typeof(v->'x') = 'number'
    and jsonb_typeof(v->'y') = 'number', false);
exception when others then return false;
end $$;

create function binder_private.image_chars(v jsonb) returns integer
language sql immutable set search_path='' as $$select length(v->>'src')$$;

create function binder_private.valid_document(doc jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  p jsonb; r jsonb; cell jsonb; item jsonb; image jsonb; title jsonb;
  ids text[] := '{}'; occupied text[]; reached text[]; pending text[];
  cells text[]; key text; neighbor text; ident text; variants jsonb;
  rows integer; columns integer; y integer; x integer; image_chars integer := 0;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' or octet_length(doc::text) > 2300000
    or jsonb_typeof(doc->'name') <> 'string' or length(btrim(doc->>'name')) not between 1 and 60
    or jsonb_typeof(doc->'pages') <> 'array' or jsonb_array_length(doc->'pages') not between 1 and 30
    or jsonb_typeof(doc->'overflow') <> 'array' or jsonb_array_length(doc->'overflow') > 2000
    or not (doc ?& array['name','pages','overflow']) then return false; end if;
  if doc ? 'frames' and not binder_private.valid_frames(doc->'frames') then return false; end if;
  if doc ? 'cover' then
    if coalesce(doc->'cover'->>'theme','') not in
      ('classic','transparent','poke','great','ultra','master','premier','custom') then return false; end if;
    if doc->'cover'->>'theme' = 'custom' then
      image := doc->'cover'->'artwork';
      if not binder_private.valid_image(image) then return false; end if;
      image_chars := binder_private.image_chars(image);
    end if;
    if doc->'cover' ? 'title' then
      title := doc->'cover'->'title';
      if not coalesce(jsonb_typeof(title->'text') = 'string' and length(title->>'text') <= 60
        and jsonb_typeof(title->'visible') = 'boolean'
        and title->>'position' in ('top','center','bottom')
        and title->>'align' in ('left','center','right')
        and title->>'size' in ('small','medium','large')
        and title->>'color' ~* '^#[0-9a-f]{6}$',false) then return false; end if;
    end if;
  end if;
  for p in select value from jsonb_array_elements(doc->'pages') loop
    if not (p ?& array['id','rows','columns','regions'])
      or jsonb_typeof(p->'rows') <> 'number' or jsonb_typeof(p->'columns') <> 'number'
      or (p->>'rows')::numeric <> trunc((p->>'rows')::numeric)
      or (p->>'columns')::numeric <> trunc((p->>'columns')::numeric) then return false; end if;
    rows := (p->>'rows')::integer; columns := (p->>'columns')::integer;
    if rows not between 1 and 6 or columns not between 1 and 6
      or rows is null or columns is null
      or jsonb_typeof(p->'regions') <> 'array'
      or jsonb_array_length(p->'regions') not between 1 and 36 then return false; end if;
    ident := p->>'id';
    if jsonb_typeof(p->'id') <> 'string' or ident is null or ident !~ '^[a-zA-Z0-9_-]{1,80}$' or ident = any(ids) then return false; end if;
    ids := array_append(ids,ident); occupied := '{}';
    for r in select value from jsonb_array_elements(p->'regions') loop
      ident := r->>'id';
      if jsonb_typeof(r->'id') <> 'string' or ident is null or ident !~ '^[a-zA-Z0-9_-]{1,80}$' or ident = any(ids) then return false; end if;
      ids := array_append(ids,ident);
      if not (r ? 'cells') or jsonb_typeof(r->'cells') <> 'array' or jsonb_array_length(r->'cells') not between 1 and 36
        or not (r ? 'content') then return false; end if;
      cells := '{}';
      for cell in select value from jsonb_array_elements(r->'cells') loop
        if jsonb_typeof(cell) <> 'array' or jsonb_array_length(cell) <> 2
          or jsonb_typeof(cell->0) <> 'number' or jsonb_typeof(cell->1) <> 'number'
          or (cell->>0)::numeric <> trunc((cell->>0)::numeric)
          or (cell->>1)::numeric <> trunc((cell->>1)::numeric) then return false; end if;
        y := (cell->>0)::integer; x := (cell->>1)::integer; key := y||','||x;
        if y < 0 or y >= rows or x < 0 or x >= columns or key = any(occupied) then return false; end if;
        occupied := array_append(occupied,key); cells := array_append(cells,key);
      end loop;
      pending := array[cells[1]]; reached := '{}';
      while cardinality(pending) > 0 loop
        key := pending[1]; pending := pending[2:];
        if key = any(reached) then continue; end if;
        reached := array_append(reached,key);
        y := split_part(key,',',1)::integer; x := split_part(key,',',2)::integer;
        foreach neighbor in array array[(y-1)||','||x,(y+1)||','||x,y||','||(x-1),y||','||(x+1)] loop
          if neighbor = any(cells) and not neighbor = any(reached) then pending := array_append(pending,neighbor); end if;
        end loop;
      end loop;
      if cardinality(reached) <> cardinality(cells) then return false; end if;
    end loop;
    if cardinality(occupied) <> rows * columns then return false; end if;
  end loop;
  for item in
    select r.value->'content' from jsonb_array_elements(doc->'pages') p,
      lateral jsonb_array_elements(p.value->'regions') r where r.value->'content' <> 'null'::jsonb
    union all select value from jsonb_array_elements(doc->'overflow')
  loop
    ident := item->>'id';
    if jsonb_typeof(item->'id') <> 'string' or ident is null or ident !~ '^[a-zA-Z0-9_-]{1,80}$' or ident = any(ids) then return false; end if;
    ids := array_append(ids,ident);
    if item->>'kind' = 'artwork' then
      if not binder_private.valid_image(item) then return false; end if;
      image_chars := image_chars + binder_private.image_chars(item);
    elsif item->>'kind' = 'placeholder' then
      if coalesce(item->>'style','') not in ('outline','soft','ball') then return false; end if;
      if item ? 'cardId' and not exists(select 1 from binder_private.catalogue c where c.card_id = item->>'cardId') then return false; end if;
    else
      if item ? 'kind' then return false; end if;
      select c.variants into variants from binder_private.catalogue c where c.card_id = item->>'cardId';
      if not found then return false; end if;
      if item ? 'variant' and (coalesce(item->>'variant','') not in ('normal','reverse','holo','firstEdition')
        or (variants is not null and not coalesce((variants->>(item->>'variant'))::boolean,false))) then return false; end if;
      if item ? 'frames' and not binder_private.valid_frames(item->'frames') then return false; end if;
    end if;
  end loop;
  return image_chars <= 1800000;
exception when others then return false;
end $$;

create table public.binders (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  position integer not null check (position between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index binders_owner_position on public.binders(owner_id,position);
alter table public.binders enable row level security;
create policy "Read own binders" on public.binders for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.binders from anon, authenticated;
grant select on public.binders to authenticated;

-- This privileged function is private because the browser must not receive
-- general table-write rights. Every operation uses the authenticated owner.
create function binder_private.commit_binders(expected jsonb, documents jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); actual jsonb; item jsonb; old public.binders; pos integer := 0;
begin
  if uid is null then raise exception 'Sign in to save binders.' using errcode = '42501'; end if;
  -- Serializes all account writes, including two simultaneous first creates.
  perform 1 from auth.users where id = uid for update;
  if not found then raise exception 'Account unavailable.' using errcode = '42501'; end if;
  if jsonb_typeof(expected) is distinct from 'array' or jsonb_typeof(documents) is distinct from 'array'
    or jsonb_array_length(documents) > 3 or jsonb_array_length(expected) > 3 then
    raise exception 'A maximum of three binders is allowed.' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision) order by id),'[]'::jsonb)
    into actual from public.binders where owner_id = uid;
  if actual <> (select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb) from jsonb_array_elements(expected)) then
    raise exception 'Binders changed on another device. Your draft has not been overwritten.' using errcode = '40001'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(documents)) <> jsonb_array_length(documents) then
    raise exception 'Duplicate binder identifier.' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(documents) loop
    if not binder_private.valid_document(item->'document') then
      raise exception 'Invalid binder document.' using errcode = '22023'; end if;
    if exists(select 1 from public.binders where id = (item->>'id')::uuid and owner_id <> uid) then
      raise exception 'Binder identifier unavailable.' using errcode = '42501'; end if;
  end loop;
  delete from public.binders where owner_id = uid
    and id not in (select (value->>'id')::uuid from jsonb_array_elements(documents));
  for item in select value from jsonb_array_elements(documents) loop
    select * into old from public.binders where id = (item->>'id')::uuid and owner_id = uid;
    if not found then
      insert into public.binders(id,owner_id,document,position) values ((item->>'id')::uuid,uid,item->'document',pos);
    elsif old.document is distinct from item->'document' or old.position <> pos then
      update public.binders set document = item->'document', position = pos,
        revision = revision + 1, updated_at = now() where id = old.id and owner_id = uid;
    end if;
    pos := pos + 1;
  end loop;
end $$;

create function public.commit_binders(expected jsonb, documents jsonb) returns void
language sql security invoker set search_path = '' as $$
  select binder_private.commit_binders(expected,documents)
$$;
revoke all on all functions in schema binder_private from public, anon, authenticated;
grant execute on function binder_private.commit_binders(jsonb,jsonb) to authenticated;
revoke all on function public.commit_binders(jsonb,jsonb) from public, anon;
grant execute on function public.commit_binders(jsonb,jsonb) to authenticated;

-- Catalogue identifiers/finishes follow the existing frontend sample contract.

insert into binder_private.catalogue(card_id,variants) values
('"001"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"004"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"007"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"025"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"133"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"151"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"166"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"167"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"168"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"169"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"170"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"171"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"172"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"173"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"174"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"175"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"176"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"177"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"178"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"179"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"180"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"181"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"182"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"183"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"184"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"185"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"186"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"187"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"188"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"189"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"190"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"191"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"192"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"193"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"194"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"195"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"196"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"197"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"198"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"199"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"200"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"201"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"202"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"203"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"204"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"205"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"hgss1-1"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":true,"reverse":true,"wPromo":false}'::jsonb),
('"bw1-1"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"bw1-2"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"xy1-1"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"xy1-2"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"sm1-1"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"sm1-2"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":false,"wPromo":false}'::jsonb),
('"swsh1-1"'::jsonb #>> '{}', '{"firstEdition":false,"holo":true,"normal":false,"reverse":false,"wPromo":false}'::jsonb),
('"swsh1-2"'::jsonb #>> '{}', '{"firstEdition":false,"holo":false,"normal":true,"reverse":true,"wPromo":false}'::jsonb);
