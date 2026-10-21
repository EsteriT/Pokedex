-- Validate collection rows together instead of 5,000 separate catalogue queries.
-- Keep the same private function, field/UTF-16 limits and duplicate-group rules.
create or replace function binder_private.valid_collection(document jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
declare valid boolean;
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if jsonb_typeof(document) is distinct from 'object'
    or document - 'records' <> '{}'::jsonb
    or jsonb_typeof(document->'records') is distinct from 'array' then return false; end if;
  if jsonb_array_length(document->'records') > 5000
    or octet_length(document::text) > 16777216 then return false; end if;
  select coalesce(bool_and(case when jsonb_typeof(r)='object' then coalesce(
    r ?& array['id','kind','cardId','finish','quantity','condition','grading','notes','chase','tradeStatus']
    and r - array['id','kind','cardId','finish','quantity','condition','grading','notes','chase','tradeStatus'] = '{}'::jsonb
    and jsonb_typeof(r->'id')='string' and r->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$'
    and jsonb_typeof(r->'cardId')='string'
    and jsonb_typeof(r->'kind')='string' and r->>'kind' in ('owned','wanted')
    and jsonb_typeof(r->'finish')='string'
    and jsonb_typeof(r->'quantity')='number' and r->>'quantity' ~ '^[1-9][0-9]{0,2}$'
    and jsonb_typeof(r->'condition')='string' and r->>'condition' in ('unknown','nm','lp','mp','hp','damaged')
    and jsonb_typeof(r->'tradeStatus')='string' and r->>'tradeStatus' in ('keep','trade','sale')
    and jsonb_typeof(r->'notes')='string'
    and length(regexp_replace(r->>'notes',U&'[\+010000-\+10FFFF]','xx','g')) <= 2000
    and jsonb_typeof(r->'chase')='boolean'
    and c.card_id is not null and (r->>'finish'='unknown' or c.variants->(r->>'finish')='true'::jsonb)
    and (r->'grading'='null'::jsonb or case when jsonb_typeof(r->'grading')='object' then
      (r->'grading') ?& array['company','grade']
      and (r->'grading') - array['company','grade']='{}'::jsonb
      and jsonb_typeof(r->'grading'->'company')='string'
      and r->'grading'->>'company' in ('PSA','BGS','CGC','Other')
      and jsonb_typeof(r->'grading'->'grade')='string'
      and btrim(r->'grading'->>'grade',trim_chars)<>''
      and r->'grading'->>'grade'=btrim(r->'grading'->>'grade',trim_chars)
      and length(regexp_replace(r->'grading'->>'grade',U&'[\+010000-\+10FFFF]','xx','g')) <= 20
      else false end)
    and (case when r->>'kind'='wanted' then
      r->'grading'='null'::jsonb and r->>'condition'='unknown' and r->>'tradeStatus'='keep'
      else r->'chase'='false'::jsonb and (r->'grading'='null'::jsonb or r->>'condition'='unknown') end)
    ,false) else false end),true)
    and count(*)=count(distinct r->>'id')
    and count(*)=count(distinct jsonb_build_array(r->>'kind',r->>'cardId',r->>'finish',
      case when r->>'kind'='owned' then r->>'condition' else '' end,
      coalesce(r->'grading'->>'company',''),coalesce(r->'grading'->>'grade','')))
    into valid
    from jsonb_array_elements(document->'records') r
    left join binder_private.catalogue c on c.card_id=r->>'cardId';
  return valid;
end $$;
