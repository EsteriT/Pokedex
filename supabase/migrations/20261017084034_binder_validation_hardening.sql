-- Keep direct API saves compatible with the browser document contract.
create or replace function binder_private.valid_document(doc jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  p jsonb; r jsonb; cell jsonb; item jsonb; image jsonb; title jsonb;
  ids text[] := '{}'; occupied text[]; reached text[]; pending text[];
  cells text[]; key text; neighbor text; ident text; variants jsonb;
  rows integer; columns integer; y integer; x integer; image_chars integer := 0;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' or octet_length(doc::text) > 2300000
    or jsonb_typeof(doc->'name') <> 'string' or length(doc->>'name') not between 1 and 60
    or doc->>'name' !~ U&'[^\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'
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
      if item ? 'cardId' and (jsonb_typeof(item->'cardId') is distinct from 'string'
        or not exists(select 1 from binder_private.catalogue c where c.card_id = item->>'cardId')) then return false; end if;
    else
      if item ? 'kind' or jsonb_typeof(item->'cardId') is distinct from 'string' then return false; end if;
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

-- Renew the grace period when retrying an old reservation before upload.
create or replace function binder_private.reserve_artwork(object_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to upload artwork.' using errcode='42501'; end if;
  perform 1 from auth.users where id=uid for update;
  if not found then raise exception 'Account unavailable.' using errcode='42501'; end if;
  if object_path is null or object_path !~ ('^'||uid::text||'/[0-9a-f]{64}\.(png|jpg|webp)$') then
    raise exception 'Invalid artwork path.' using errcode='22023'; end if;
  update binder_private.artwork set created_at=now() where path=object_path and owner_id=uid;
  if found then return; end if;
  if (select count(*) from binder_private.artwork where owner_id=uid) >= 60 then
    raise exception 'Artwork storage is full. Remove unused artwork from Account, or download a backup.' using errcode='22023'; end if;
  insert into binder_private.artwork(path,owner_id) values(object_path,uid);
end $$;

revoke all on public.binders from public;
