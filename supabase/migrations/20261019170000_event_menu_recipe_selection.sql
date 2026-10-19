-- Persist the menu-catalog selections made for each individual event.
-- An event can choose a subset of each section without changing the reusable menu.
alter table public.production_events
  add column if not exists selected_recipe_ids jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_events_selected_recipe_ids_array_check'
      and conrelid = 'public.production_events'::regclass
  ) then
    alter table public.production_events
      add constraint production_events_selected_recipe_ids_array_check
      check (jsonb_typeof(selected_recipe_ids) = 'array');
  end if;
end $$;

comment on column public.production_events.selected_recipe_ids is
  'Recipe ids chosen from the event menu catalog for this specific production event. Empty arrays preserve legacy behavior.';
