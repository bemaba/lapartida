-- La Partida: módulo de recetas
-- Copia SQL de referencia. Para cambios versionados, usar migrations/ y Supabase CLI.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '',
  photo_url text,
  cuisine_type text not null default 'Otra',
  category text not null default 'Principal',
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
