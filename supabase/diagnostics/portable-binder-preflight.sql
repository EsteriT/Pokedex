-- Read-only counts. Works before the new validation migration is installed.
with images as (
  select b.id, image.value as image
  from public.binders b cross join lateral (
    select b.document->'cover'->'artwork' as value
      where b.document->'cover'->>'theme'='custom'
    union all
    select r.value->'content' from jsonb_array_elements(b.document->'pages') p,
      lateral jsonb_array_elements(p.value->'regions') r
      where r.value->'content'->>'kind'='artwork'
    union all
    select value from jsonb_array_elements(b.document->'overflow')
      where value->>'kind'='artwork'
  ) image
), invalid_text as (
  select id from public.binders where
    length(regexp_replace(document->>'name',U&'[\+010000-\+10FFFF]','xx','g'))>60
    or length(regexp_replace(document->'cover'->'title'->>'text',U&'[\+010000-\+10FFFF]','xx','g'))>60
  union
  select id from images where
    length(regexp_replace(image->>'name',U&'[\+010000-\+10FFFF]','xx','g'))>100
), invalid_image as (
  select distinct i.id from images i join storage.objects o
    on o.bucket_id='binder-artwork' and o.name=substring(i.image->>'src' from 9)
    where ((coalesce((o.metadata->>'size')::bigint,0)+2)/3)*4+23>650000
), missing_image as (
  select distinct i.id from images i where not exists (
    select 1 from storage.objects o where o.bucket_id='binder-artwork'
      and o.name=substring(i.image->>'src' from 9)
  )
)
select (select count(*) from invalid_text) as binders_with_oversized_text,
  (select count(*) from invalid_image) as binders_with_oversized_images,
  (select count(*) from missing_image) as binders_with_missing_images;
