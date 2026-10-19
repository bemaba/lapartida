-- Configurable selection blocks for base menus (e.g. choose 3 of 5 starters).
alter table public.menu_items
  add column if not exists section_name text not null default 'Otros',
  add column if not exists selection_count integer;

update public.menu_items
set section_name = case
  when course = 'Aperitivo' then 'Aperitivos'
  when course = 'Entrante' then 'Entrantes'
  when course = 'Principal' then 'Platos principales'
  when course = 'Guarnición' then 'Guarniciones'
  when course = 'Postre' then 'Postres'
  else 'Otros'
end
where section_name = 'Otros';

alter table public.menu_items
  drop constraint if exists menu_items_selection_count_check;
alter table public.menu_items
  add constraint menu_items_selection_count_check
  check (selection_count is null or selection_count > 0);

create index if not exists menu_items_menu_section_order_idx
  on public.menu_items (menu_id, section_name, sort_order);

comment on column public.menu_items.section_name is
  'Named menu block used to group options such as starters, hot dishes or desserts.';
comment on column public.menu_items.selection_count is
  'Number of recipes the customer may choose from this block. NULL means no fixed selection rule.';
