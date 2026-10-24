-- Compact public directory: full cards are fetched only through bounded search/lookup.
create or replace function public.catalogue_info() returns jsonb
language sql stable security definer set search_path = '' set statement_timeout = '3s' as $$
  select jsonb_build_object(
    'searchVersion', 3,
    'metadataVersion', 2,
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.set_id, 'name', s.record->>'name', 'count', (s.record->>'count')::integer, 'preview', '[]'::jsonb,
      'expectedCount', coalesce((s.record->>'expectedCount')::integer,(s.record->>'count')::integer),
      'logo', coalesce(s.record->>'logo', substring(s.record->'preview'->0->>'imageUrl' from '^(https://assets[.]tcgdex[.]net/en/[^/]+/[^/]+/)') || 'logo'),
      'releaseDate', s.record->>'releaseDate', 'missingImages', coalesce((s.record->>'missingImages')::integer,0)
    ) order by s.record->>'name') from binder_private.catalogue_sets s),'[]'::jsonb),
    'illustrators', coalesce((select jsonb_agg(v order by v) from (select distinct record->>'illustrator' v from binder_private.catalogue where record is not null and coalesce(record->>'illustrator','')<>'') x),'[]'::jsonb),
    'categories', coalesce((select jsonb_agg(v order by v) from (select distinct record->>'category' v from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'finishes', coalesce((select jsonb_agg(v order by v) from (select distinct f.key v from binder_private.catalogue c cross join lateral jsonb_each(c.variants) f where c.record is not null and f.value='true'::jsonb) x),'[]'::jsonb),
    'types', coalesce((select jsonb_agg(v order by v) from (select distinct jsonb_array_elements_text(record->'pokemonTypes') v from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'rarities', coalesce((select jsonb_agg(v order by v) from (select distinct record->>'rarity' v from binder_private.catalogue where record is not null) x),'[]'::jsonb),
    'count', (select count(*) from binder_private.catalogue where record is not null)
  )
$$;
