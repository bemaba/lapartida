-- Módulo de menús: los menús reutilizan las recetas del recetario mediante referencias.
-- La etiqueta temática del menú es independiente de la categoría/pase de cada receta.

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '',
  theme_label text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menus_status_created_idx on public.menus (status, created_at desc);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  course text not null default 'Otro' check (course in ('Aperitivo', 'Entrante', 'Principal', 'Guarnición', 'Postre', 'Otro')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (menu_id, recipe_id)
);

create index if not exists menu_items_menu_order_idx on public.menu_items (menu_id, sort_order);

alter table public.menus enable row level security;
alter table public.menu_items enable row level security;

drop policy if exists "Active users can read published menus" on public.menus;
create policy "Active users can read published menus"
on public.menus for select to authenticated
using (
  exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
  and (status = 'published' or public.is_admin())
);

drop policy if exists "Admins can create menus" on public.menus;
create policy "Admins can create menus"
on public.menus for insert to authenticated
with check (
  public.is_admin()
  and created_by = auth.uid()
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true)
);

drop policy if exists "Admins can update menus" on public.menus;
create policy "Admins can update menus"
on public.menus for update to authenticated
using (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true))
with check (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true));

drop policy if exists "Admins can delete menus" on public.menus;
create policy "Admins can delete menus"
on public.menus for delete to authenticated
using (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true));

drop policy if exists "Active users can read menu items" on public.menu_items;
create policy "Active users can read menu items"
on public.menu_items for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.menus m on m.id = menu_items.menu_id
    where p.user_id = auth.uid() and p.active = true
      and (m.status = 'published' or public.is_admin())
  )
);

drop policy if exists "Admins can create menu items" on public.menu_items;
create policy "Admins can create menu items"
on public.menu_items for insert to authenticated
with check (
  public.is_admin()
  and exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active = true
  )
);

drop policy if exists "Admins can update menu items" on public.menu_items;
create policy "Admins can update menu items"
on public.menu_items for update to authenticated
using (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true))
with check (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true));

drop policy if exists "Admins can delete menu items" on public.menu_items;
create policy "Admins can delete menu items"
on public.menu_items for delete to authenticated
using (public.is_admin() and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active = true));

grant select, insert, update, delete on public.menus, public.menu_items to authenticated;
