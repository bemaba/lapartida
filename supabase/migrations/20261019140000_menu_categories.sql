-- Categorize menus independently from their optional theme label.
alter table public.menus
  add column if not exists menu_type text not null default 'semanal';

update public.menus
set menu_type = case
  when nullif(trim(theme_label), '') is not null then 'tematico'
  else 'semanal'
end
where menu_type = 'semanal';

alter table public.menus
  drop constraint if exists menus_menu_type_check;

alter table public.menus
  add constraint menus_menu_type_check
  check (menu_type in ('semanal', 'tematico', 'evento'));

comment on column public.menus.menu_type is
  'Menu category: semanal (weekly/weekend), tematico, or evento.';
