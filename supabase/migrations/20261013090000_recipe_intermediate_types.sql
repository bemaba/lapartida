-- La Partida: separar platos finales y elaboraciones intermedias.
-- Ejecutar en Supabase SQL Editor antes de utilizar la nueva gestión de recetas.

alter table public.recipes
  add column if not exists recipe_type text not null default 'final',
  add column if not exists yield_quantity numeric,
  add column if not exists yield_unit text not null default 'g';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_recipe_type_check') then
    alter table public.recipes add constraint recipes_recipe_type_check
      check (recipe_type in ('final', 'intermediate'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recipes_yield_quantity_check') then
    alter table public.recipes add constraint recipes_yield_quantity_check
      check (yield_quantity is null or yield_quantity > 0);
  end if;
end $$;

-- Mantiene las relaciones existentes: cualquier receta usada como componente
-- se clasifica como elaboración intermedia sin alterar ingredientes ni pasos.
update public.recipes component
set recipe_type = 'intermediate'
where exists (
  select 1
  from public.recipes parent
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(parent.ingredients) = 'array' then parent.ingredients else '[]'::jsonb end
  ) ingredient
  where ingredient->>'recipe_id' = component.id::text
);

create or replace function public.validate_recipe_components()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ingredient jsonb;
  linked_id uuid;
  linked_type text;
  creates_cycle boolean;
begin
  if new.recipe_type = 'final' and exists (
    select 1
    from public.recipes parent
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(parent.ingredients) = 'array' then parent.ingredients else '[]'::jsonb end
    ) item
    where parent.id <> new.id and item->>'recipe_id' = new.id::text
  ) then
    raise exception 'Esta receta está vinculada como elaboración de otro plato; desvincúlala antes de convertirla en plato final.';
  end if;

  for ingredient in
    select value from jsonb_array_elements(
      case when jsonb_typeof(new.ingredients) = 'array' then new.ingredients else '[]'::jsonb end
    )
  loop
    if coalesce(ingredient->>'recipe_id', '') = '' then continue; end if;
    if (ingredient->>'recipe_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'El identificador de la elaboración vinculada no es válido.';
    end if;
    linked_id := (ingredient->>'recipe_id')::uuid;
    if linked_id = new.id then raise exception 'Una receta no puede incluirse a sí misma como elaboración.'; end if;
    select recipe_type into linked_type from public.recipes where id = linked_id;
    if not found then raise exception 'La elaboración vinculada no existe.'; end if;
    if linked_type <> 'intermediate' then raise exception 'Solo se pueden vincular recetas clasificadas como elaboraciones intermedias.'; end if;

    with recursive dependencies(id) as (
      select linked_id
      union
      select (item->>'recipe_id')::uuid
      from dependencies d
      join public.recipes r on r.id = d.id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(r.ingredients) = 'array' then r.ingredients else '[]'::jsonb end
      ) item
      where coalesce(item->>'recipe_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    select exists(select 1 from dependencies where id = new.id) into creates_cycle;
    if creates_cycle then raise exception 'Esta relación crearía un ciclo entre recetas.'; end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists recipes_validate_components on public.recipes;
create trigger recipes_validate_components
before insert or update on public.recipes
for each row execute function public.validate_recipe_components();
