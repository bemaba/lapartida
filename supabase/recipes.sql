-- La Partida: módulo de recetas
-- Copia SQL de referencia. Para cambios versionados, usar migrations/ y Supabase CLI.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '',
  photo_url text,
  cuisine_type text not null default 'Otra',
  category text not null default 'Principal',
  recipe_type text not null default 'final' check (recipe_type in ('final', 'intermediate')),
  yield_quantity numeric check (yield_quantity is null or yield_quantity > 0),
  yield_unit text not null default 'g',
  tags text[] not null default '{}',
  servings integer not null default 10 check (servings > 0 and servings <= 100000),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  difficulty text not null default 'Media' check (difficulty in ('Fácil', 'Media', 'Alta')),
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  allergens text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  storage_notes text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz
);

alter table public.recipes
  add column if not exists recipe_type text not null default 'final',
  add column if not exists yield_quantity numeric,
  add column if not exists yield_unit text not null default 'g';

create index if not exists recipes_status_created_idx on public.recipes (status, created_at desc);
create index if not exists recipes_created_by_idx on public.recipes (created_by);
create index if not exists recipes_title_search_idx on public.recipes using gin (to_tsvector('spanish', title || ' ' || description));

create or replace function public.set_recipe_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_updated_at on public.recipes;
create trigger recipes_updated_at
before update on public.recipes
for each row execute function public.set_recipe_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "Active users can read published recipes and own drafts" on public.recipes;
create policy "Active users can read published recipes and own drafts"
on public.recipes for select to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
  and (
    status = 'published'
    or created_by = auth.uid()
    or public.is_admin()
  )
);

drop policy if exists "Active users can add recipe drafts" on public.recipes;
create policy "Active users can add recipe drafts"
on public.recipes for insert to authenticated
with check (
  created_by = auth.uid()
  and status = 'draft'
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
);

drop policy if exists "Authors can edit own drafts" on public.recipes;
create policy "Authors can edit own drafts"
on public.recipes for update to authenticated
using (
  created_by = auth.uid()
  and status = 'draft'
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
)
with check (
  created_by = auth.uid()
  and status = 'draft'
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
);

drop policy if exists "Admins can update recipes" on public.recipes;
create policy "Admins can update recipes"
on public.recipes for update to authenticated
using (
  public.is_admin()
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
)
with check (
  public.is_admin()
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
);

drop policy if exists "Admins can delete recipes" on public.recipes;
create policy "Admins can delete recipes"
on public.recipes for delete to authenticated
using (
  public.is_admin()
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
);

grant select, insert, update, delete on public.recipes to authenticated;


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
