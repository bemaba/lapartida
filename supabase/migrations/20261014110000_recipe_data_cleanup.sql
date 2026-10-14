-- La Partida: conservative cleanup of imported recipe text and ingredient quantities.
-- Does not create cooking instructions or infer missing amounts.

update public.recipes
set description = ''
where status <> 'published'
  and (description ~* '^\s*Transcripci[oó]n fiel del documento'
   or description ~* '^\s*Rendimiento no indicado en la fuente');

-- Remove the import/editorial disclaimer when it was appended to an otherwise useful description.
update public.recipes
set description = btrim(regexp_replace(
  description,
  '(\n|\r|\s)*Rendimiento no indicado en la fuente;? revisar antes de escalar cantidades\.?\s*$',
  '',
  'i'
))
where status <> 'published'
  and description ~* 'Rendimiento no indicado en la fuente';

-- When the imported ingredient name starts with a measurable amount (e.g. "120g nueces picadas"),
-- move that amount to quantity and leave the ingredient name clean. Explicit quantities are preserved.
with cleaned as (
  select r.id,
         jsonb_agg(
           case
             when coalesce(nullif(btrim(item->>'quantity'), ''), '') = ''
               and btrim(regexp_replace(coalesce(item->>'name',''), '^Cantidad al gusto\s+', '', 'i'))
                   ~* '^\s*[0-9]+([.,][0-9]+)?\s*(kg|mg|g|gr|gramos?|l|ml|cl|dl|unidades?|uds?)\s+.+$'
             then
               jsonb_set(
                 jsonb_set(
                   item,
                   '{quantity}',
                   to_jsonb((regexp_match(
                     btrim(regexp_replace(coalesce(item->>'name',''), '^Cantidad al gusto\s+', '', 'i')),
                     '^\s*([0-9]+([.,][0-9]+)?\s*(kg|mg|g|gr|gramos?|l|ml|cl|dl|unidades?|uds?))\s+(.+)$',
                     'i'
                   ))[1]),
                   true
                 ),
                 '{name}',
                 to_jsonb(btrim((regexp_match(
                   btrim(regexp_replace(coalesce(item->>'name',''), '^Cantidad al gusto\s+', '', 'i')),
                   '^\s*([0-9]+([.,][0-9]+)?\s*(kg|mg|g|gr|gramos?|l|ml|cl|dl|unidades?|uds?))\s+(.+)$',
                   'i'
                 ))[4])),
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
  group by r.id
)
update public.recipes r
set ingredients = cleaned.ingredients
from cleaned
where cleaned.id = r.id
  and r.status <> 'published'
  and r.ingredients is distinct from cleaned.ingredients;

-- Classify only clearly identifiable generic "Otro" records; ambiguous recipes remain unchanged.
update public.recipes
set category = case
  when title ~* '(salsa|vinagreta|mayonesa|alioli|pesto|chimichurri)' then 'Salsa'
  when title ~* '(fondo|caldo|fumet|base de|demi.?glace|reducci[oó]n)' then 'Base'
  when title ~* '(pan |pan$|masa de|brioche|focaccia|galleta|bizcocho)' then 'Panadería'
  when title ~* '(helado|sorbete|mousse|brownie|tarta|crema catalana|flan|postre|chocolate)' then 'Postre'
  when title ~* '(pur[eé]|patata asada|verduras asadas|arroz blanco|guarnici[oó]n)' then 'Guarnición'
  else category
end
where status <> 'published'
  and coalesce(nullif(btrim(category), ''), 'Otro') = 'Otro';

-- Deliberately no automatic step generation: missing instructions must be completed from a trusted source.
