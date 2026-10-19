-- Reconcile existing menu items with the Singularis catalog categories.
-- Preserve recipe links and selection rules; only normalize section labels and display order.
update public.menu_items mi
set section_name = case
  when lower(trim(coalesce(r.category, ''))) in ('frío', 'frio') then 'Fríos'
  when lower(trim(coalesce(r.category, ''))) = 'caliente' then 'Calientes'
  when lower(trim(coalesce(r.category, ''))) = 'postre' then 'Postres'
  when lower(trim(coalesce(r.category, ''))) in ('estación', 'estacion') then 'Estaciones'
  when mi.course = 'Postre' then 'Postres'
  else mi.section_name
end
from public.recipes r
where r.id = mi.recipe_id
  and lower(trim(coalesce(r.category, ''))) in ('frío', 'frio', 'caliente', 'postre', 'estación', 'estacion');

-- Give every menu a deterministic order: cold, hot, dessert, then other sections.
with ranked as (
  select
    mi.id,
    row_number() over (
      partition by mi.menu_id
      order by
        case lower(trim(mi.section_name))
          when 'fríos' then 0 when 'frio' then 0 when 'fríos' then 0
          when 'calientes' then 1 when 'caliente' then 1
          when 'postres' then 2 when 'postre' then 2
          when 'estaciones' then 3 when 'estación' then 3
          else 4
        end,
        mi.sort_order,
        r.title
    ) - 1 as new_sort_order
  from public.menu_items mi
  join public.recipes r on r.id = mi.recipe_id
)
update public.menu_items mi
set sort_order = ranked.new_sort_order
from ranked
where ranked.id = mi.id;
