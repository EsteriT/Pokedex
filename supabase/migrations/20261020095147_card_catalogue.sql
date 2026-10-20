-- Shared public card information lives separately from private account documents.
-- Clients can execute bounded read functions, but cannot read/write these tables.
create table binder_private.catalogue_sets (
  set_id text primary key check (length(set_id) between 1 and 40),
  record jsonb not null check (jsonb_typeof(record) = 'object' and record->>'id' = set_id)
);
alter table binder_private.catalogue_sets enable row level security;
revoke all on binder_private.catalogue_sets from public, anon, authenticated;
alter table binder_private.catalogue add column record jsonb;
alter table binder_private.catalogue enable row level security;
alter table binder_private.catalogue add constraint catalogue_record_identity
  check (record is null or (jsonb_typeof(record) = 'object' and record->>'id' = card_id));
create unique index catalogue_provider_id on binder_private.catalogue ((record->>'providerId')) where record is not null;
create index catalogue_set on binder_private.catalogue ((record->>'setId')) where record is not null;
create index catalogue_name on binder_private.catalogue (lower(record->>'name'),card_id) where record is not null;

create function public.catalogue_info() returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '3s' as $$
  select jsonb_build_object(
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

create function public.catalogue_cards(ids text[]) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '3s' as $$
begin
  if ids is null or cardinality(ids) > 100 or array_ndims(ids) <> 1
    or exists(select 1 from unnest(ids) x where x is null or length(x) not between 1 and 80) then
    raise exception 'Request at most 100 card identifiers.' using errcode='22023';
  end if;
  return coalesce((select jsonb_agg(record || jsonb_build_object('variants',variants))
    from binder_private.catalogue where card_id = any(ids) and record is not null),'[]'::jsonb);
end $$;

create function public.search_catalogue(filters jsonb default '{}'::jsonb, page_number integer default 1) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '3s' as $$
declare
  q text := lower(btrim(coalesce(filters->>'q','')));
  wanted_set text := coalesce(filters->>'set','');
  wanted_type text := coalesce(filters->>'type','');
  wanted_rarity text := coalesce(filters->>'rarity','');
  wanted_finish text := coalesce(filters->>'finish','');
  ordering text := coalesce(filters->>'sort','name');
  result jsonb;
begin
  if filters is null or jsonb_typeof(filters) <> 'object' or octet_length(filters::text)>2000
    or length(q)>120 or length(wanted_set)>160 or length(wanted_type)>40 or length(wanted_rarity)>100
    or page_number is null or page_number not between 1 and 1000
    or wanted_finish not in ('','normal','reverse','holo','firstEdition')
    or ordering not in ('name','set','number') then
    raise exception 'Invalid catalogue search.' using errcode='22023';
  end if;
  -- Bounded ten-set trial. Benchmark search before expanding to the full catalogue.
  with matches as materialized (
    select card_id,record || jsonb_build_object('variants',variants) as card
    from binder_private.catalogue
    where record is not null
      and (wanted_set='' or record->>'setId'=wanted_set or record->>'setName'=wanted_set)
      and (wanted_type='' or (record->'pokemonTypes') ? wanted_type)
      and (wanted_rarity='' or record->>'rarity'=wanted_rarity)
      and (wanted_finish='' or variants->wanted_finish='true'::jsonb)
      and (q='' or case when exists(select 1 from binder_private.catalogue exact where lower(exact.record->>'providerId')=q)
        then lower(record->>'providerId')=q
        when q ~ '^#?[0-9]+$'
        then ltrim(replace(q,'#',''),'0')=ltrim(record->>'collectorNumber','0')
        else strpos(lower(concat_ws(' ',record->>'name',record->>'collectorNumber',record->>'setName',record->>'setId',record->>'providerId')),q)>0 end)
  ), slice as (
    select * from matches
    order by
      case when ordering in ('set','number') then card->>'setName' else '' end,
      case when ordering='number' then lpad(card->>'collectorNumber',30,'0') else lower(card->>'name') end,
      card_id
    limit 24 offset ((page_number-1)*24)
  )
  select jsonb_build_object('total',(select count(*) from matches),'cards',coalesce((select jsonb_agg(card) from slice),'[]'::jsonb)) into result;
  return result;
end $$;

revoke all on function public.catalogue_info() from public;
revoke all on function public.catalogue_cards(text[]) from public;
revoke all on function public.search_catalogue(jsonb,integer) from public;
grant execute on function public.catalogue_info() to anon,authenticated;
grant execute on function public.catalogue_cards(text[]) to anon,authenticated;
grant execute on function public.search_catalogue(jsonb,integer) to anon,authenticated;
