-- Convert the existing thematic menu proposals to the event-menu model.
-- Keep every recipe link, but normalize each menu-item section into one of
-- the three event blocks. Selection counts represent customer choices, not
-- the total number of available recipes in a block.

update public.menu_items mi
set section_name = case
  when lower(trim(coalesce(r.category, ''))) in ('frío', 'frio', 'fríos', 'frios') then 'Fríos'
  when lower(trim(coalesce(r.category, ''))) in ('caliente', 'calientes') then 'Calientes'
  when lower(trim(coalesce(r.category, ''))) in ('postre', 'postres')
    or lower(trim(coalesce(mi.course, ''))) = 'postre' then 'Postres'
  when lower(trim(coalesce(mi.course, ''))) in ('principal', 'guarnición', 'guarnicion') then 'Calientes'
  else 'Fríos'
end
from public.menus m, public.recipes r
where m.id = mi.menu_id
  and r.id = mi.recipe_id
  and m.menu_type = 'tematico';

update public.menus
set menu_type = 'evento',
    updated_at = now()
where menu_type = 'tematico';

-- Every item in an event block stores the same "choose N" value. Keep the
-- standard defaults 4/3/2 even when an old proposal has fewer options; the
-- editor will explain that more options are required before it can be saved.
update public.menu_items mi
set selection_count = case section_name
  when 'Fríos' then 4
  when 'Calientes' then 3
  when 'Postres' then 2
  else selection_count
end
where mi.menu_id in (
  select id from public.menus where menu_type = 'evento'
)
and section_name in ('Fríos', 'Calientes', 'Postres');
