-- Conservative cleanup of UNPUBLISHED recipes only.
-- Published recipes are intentionally excluded from every update below.
-- Amounts are extracted only when the text has an explicit, recognizable quantity.
-- No cooking steps, quantities, yields, or categories are invented.

update public.recipes
set description = case
  when description ~* '^\s*Transcripci[oó]n fiel del documento' then ''
  else btrim(regexp_replace(
    regexp_replace(
      description,
      '(^|\s*)Transcripci[oó]n fiel del documento[^.]*\.\s*Se conservan las cantidades y solo se incluyen pasos expresos; no se inventan los que faltan\.\s*',
      '',
      'i'
    ),
    '(\s|[;,.])*Rendimiento no indicado en la fuente;?\s*revisar antes de escalar cantidades\.?\s*$',
    '',
    'i'
  ))
end
where status <> 'published'
  and coalesce(description, '') ~* '(Transcripci[oó]n fiel del documento|Rendimiento no indicado en la fuente)';

-- Remove import-only labels, keeping any other tags.
update public.recipes
set tags = coalesce((
  select array_agg(tag order by ordinality)
  from unnest(coalesce(recipes.tags, '{}'::text[])) with ordinality as t(tag, ordinality)
  where tag not in ('Menús originales', 'Importado')
), '{}'::text[])
where status <> 'published'
  and coalesce(tags, '{}'::text[]) && array['Menús originales', 'Importado']::text[];

-- Normalize ingredient quantities for common source formats:
-- "120g nueces", "3,5k alubias", "6 hojas laurel", "Boniato frito 60g".
-- Only moves an amount when quantity is empty; does not overwrite an existing quantity.
with expanded as (
  select r.id,
         jsonb_agg(
           case
             when coalesce(nullif(btrim(item->>'quantity'), ''), '') = ''
              and (
                btrim(coalesce(item->>'name','')) ~* '^[0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)\s+.+$'
                or btrim(coalesce(item->>'name','')) ~* '^.+\s+[0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)$'
              )
             then
               jsonb_set(
                 jsonb_set(
                   item,
                   '{quantity}',
                   to_jsonb(
                     CASE
                       WHEN btrim(item->>'name') ~* '^[0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)\s+.+$'
                       THEN (regexp_match(btrim(item->>'name'), '^([0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?))\s+.+$', 'i'))[1]
                       ELSE (regexp_match(btrim(item->>'name'), '^.+\s+([0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?))$', 'i'))[1]
                     END
                   ),
                   true
                 ),
                 '{name}',
                 to_jsonb(
                   btrim(
                     CASE
                       WHEN btrim(item->>'name') ~* '^[0-9]+([,.][0-9]+)?\s*(kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)\s+.+$'
                       THEN (regexp_match(btrim(item->>'name'), '^[0-9]+([,.][0-9]+)?\s*(?:kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)\s+(.+)$', 'i'))[2]
                       ELSE (regexp_match(btrim(item->>'name'), '^(.+)\s+[0-9]+([,.][0-9]+)?\s*(?:kg|k|mg|g|gr|gramos?|l|ml|cl|dl|cc|unidades?|uds?|u|hojas?|dientes?|lonchas?|raciones?|piezas?)$', 'i'))[1]
                     END
                   )
                 ),
                 true
               )
             else item
           end
           order by ordinality
         ) as ingredients
  from public.recipes r
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.ingredients) = 'array' then r.ingredients else '[]'::jsonb end
  ) with ordinality as rows(item, ordinality)
  where r.status <> 'published'
  group by r.id
)
update public.recipes r
set ingredients = expanded.ingredients
from expanded
where r.id = expanded.id
  and r.status <> 'published'
  and r.ingredients is distinct from expanded.ingredients;

-- Remove empty step placeholders only; retain all real source instructions.
with cleaned as (
  select r.id,
         coalesce(jsonb_agg(step order by ordinality) filter (
           where btrim(coalesce(step->>'instruction','')) <> ''
         ), '[]'::jsonb) as steps
  from public.recipes r
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.steps) = 'array' then r.steps else '[]'::jsonb end
  ) with ordinality as rows(step, ordinality)
  where r.status <> 'published'
  group by r.id
)
update public.recipes r
set steps = cleaned.steps
from cleaned
where r.id = cleaned.id
  and r.status <> 'published'
  and r.steps is distinct from cleaned.steps;

-- No auto-generated instructions and no automatic changes to recipe categories:
-- ambiguous cases require review against the original kitchen documents.
