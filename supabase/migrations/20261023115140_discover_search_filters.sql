-- Public catalogue search only; no private document or permission changes.
create or replace function public.catalogue_info() returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '3s' as $$
  select jsonb_build_object(
    'searchVersion', 3,
    'illustrators', coalesce((select jsonb_agg(v order by v) from (select distinct record->>'illustrator' v from binder_private.catalogue where record is not null and coalesce(record->>'illustrator','')<>'') x),'[]'::jsonb),
    'categories', coalesce((select jsonb_agg(v order by v) from (select distinct record->>'category' v from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'sets', coalesce((select jsonb_agg(s.record || jsonb_build_object('preview',
      coalesce((select jsonb_agg(c.record || jsonb_build_object('variants',c.variants))
        from binder_private.catalogue c join jsonb_array_elements(s.record->'preview') p on c.card_id=p->>'id'), '[]'::jsonb))
      order by s.record->>'name') from binder_private.catalogue_sets s),'[]'::jsonb),
    'types', coalesce((select jsonb_agg(t order by t) from (
      select distinct jsonb_array_elements_text(record->'pokemonTypes') t
      from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'rarities', coalesce((select jsonb_agg(r order by r) from (
      select distinct record->>'rarity' r from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'count', (select count(*) from binder_private.catalogue where record is not null)
  )
$$;

create or replace function public.search_catalogue(filters jsonb default '{}'::jsonb, page_number integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '3s' as $$
declare
  q text := lower(btrim(coalesce(filters->>'q','')));
  wanted_set jsonb := coalesce(filters->'set', '""'::jsonb);
  wanted_type jsonb := coalesce(filters->'type', '""'::jsonb);
  wanted_rarity jsonb := coalesce(filters->'rarity', '""'::jsonb);
  wanted_finish jsonb := coalesce(filters->'finish', '""'::jsonb);
  wanted_category jsonb := coalesce(filters->'category', '""'::jsonb);
  wanted_illustrator jsonb := coalesce(filters->'illustrator', '""'::jsonb);
  scope text := coalesce(nullif(filters->>'qScope',''),'all');
  type_matching text := coalesce(nullif(filters->>'typeMatch',''),'any');
  ordering text := coalesce(filters->>'sort','name');
  result jsonb;
  item jsonb;
  hp_low integer;
  hp_high integer;
begin
  if filters is null or jsonb_typeof(filters) <> 'object' or octet_length(filters::text)>2000
    or length(q)>120
    or page_number is null or page_number not between 1 and 1000
    or scope not in ('all','name','number','set','illustrator')
    or type_matching not in ('any','all')
    or ordering not in ('name','name-desc','set','number','number-desc','hp','hp-desc') then
    raise exception 'Invalid catalogue search.' using errcode='22023';
  end if;
  foreach item in array array[wanted_set,wanted_type,wanted_rarity,wanted_finish,wanted_category,wanted_illustrator] loop
    if jsonb_typeof(item)='string' then item := jsonb_build_array(item); end if;
    if jsonb_typeof(item) <> 'array' then raise exception 'Invalid catalogue search.' using errcode='22023'; end if;
    if jsonb_array_length(item)>20 or exists(select 1 from jsonb_array_elements(item) x where jsonb_typeof(x)<>'string' or length(x#>>'{}')>160) then
      raise exception 'Invalid catalogue search.' using errcode='22023';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_finish)='array' then wanted_finish else jsonb_build_array(wanted_finish) end) v where v not in ('','normal','reverse','holo','firstEdition'))
    or coalesce(filters->>'hpMin','') !~ '^([0-9]{1,5})?$' or coalesce(filters->>'hpMax','') !~ '^([0-9]{1,5})?$' then
    raise exception 'Invalid catalogue search.' using errcode='22023';
  end if;
  hp_low := nullif(filters->>'hpMin','')::integer;
  hp_high := nullif(filters->>'hpMax','')::integer;
  if hp_low>10000 or hp_high>10000 or hp_low>hp_high then raise exception 'Invalid HP range.' using errcode='22023'; end if;
  -- Reuse matched rows for the total and bounded page under the fixed query timeout.
  with matches as materialized (
    select card_id,record || jsonb_build_object('variants',variants) as card
    from binder_private.catalogue
    where record is not null
      and (wanted_set in ('""'::jsonb,'[]'::jsonb) or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_set)='array' then wanted_set else jsonb_build_array(wanted_set) end) v where record->>'setId'=v or record->>'setName'=v))
      and (wanted_type in ('""'::jsonb,'[]'::jsonb) or case when type_matching='all' then not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_type)='array' then wanted_type else jsonb_build_array(wanted_type) end) v where not (record->'pokemonTypes') ? v) else exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_type)='array' then wanted_type else jsonb_build_array(wanted_type) end) v where (record->'pokemonTypes') ? v) end)
      and (wanted_rarity in ('""'::jsonb,'[]'::jsonb) or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_rarity)='array' then wanted_rarity else jsonb_build_array(wanted_rarity) end) v where record->>'rarity'=v))
      and (wanted_finish in ('""'::jsonb,'[]'::jsonb) or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_finish)='array' then wanted_finish else jsonb_build_array(wanted_finish) end) v where variants->v='true'::jsonb))
      and (wanted_category in ('""'::jsonb,'[]'::jsonb) or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(wanted_category)='array' then wanted_category else jsonb_build_array(wanted_category) end) v where record->>'category'=v))
      and (wanted_illustrator in ('""'::jsonb,'[]'::jsonb) or case when jsonb_typeof(wanted_illustrator)='array' then exists(select 1 from jsonb_array_elements_text(wanted_illustrator) v where record->>'illustrator'=v) else strpos(lower(record->>'illustrator'),lower(wanted_illustrator#>>'{}'))>0 end)
      and (hp_low is null or (record->>'hp')::integer>=hp_low)
      and (hp_high is null or (record->>'hp')::integer<=hp_high)
      and (q='' or case
        when scope='name' then strpos(lower(record->>'name'),q)>0
        when scope='number' then case when q ~ '^#?[0-9]+$' then ltrim(replace(q,'#',''),'0')=ltrim(record->>'collectorNumber','0') else lower(record->>'collectorNumber')=replace(q,'#','') end
        when scope='set' then strpos(lower(concat_ws(' ',record->>'setName',record->>'setId')),q)>0
        when scope='illustrator' then strpos(lower(record->>'illustrator'),q)>0
        when exists(select 1 from binder_private.catalogue exact where lower(exact.record->>'providerId')=q)
        then lower(record->>'providerId')=q
        when q ~ '^#?[0-9]+$'
        then ltrim(replace(q,'#',''),'0')=ltrim(record->>'collectorNumber','0')
        else strpos(lower(concat_ws(' ',record->>'name',record->>'collectorNumber',record->>'setName',record->>'setId',record->>'providerId',record->>'illustrator')),q)>0 end)
  ), slice as (
    select * from matches
    order by
      case when ordering in ('set','number','number-desc') then card->>'setName' else '' end,
      case when ordering='number' then lpad(card->>'collectorNumber',30,'0') when ordering in ('name','set') then lower(card->>'name') else '' end,
      case when ordering='name-desc' then lower(card->>'name') end desc,
      case when ordering='number-desc' then lpad(card->>'collectorNumber',30,'0') end desc,
      case when ordering='hp' then (card->>'hp')::integer end asc nulls last,
      case when ordering='hp-desc' then (card->>'hp')::integer end desc nulls last,
      card_id
    limit 24 offset ((page_number-1)*24)
  )
  select jsonb_build_object('total',(select count(*) from matches),'cards',coalesce((select jsonb_agg(card) from slice),'[]'::jsonb)) into result;
  return result;
end $$;

