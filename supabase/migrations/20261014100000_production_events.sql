-- La Partida: planificación de producción por evento y por día.
-- No gestiona precios, proveedores ni pedidos: utiliza recetas y menús existentes.

create table if not exists public.production_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 180),
  event_date date not null,
  service_time time,
  guest_count integer not null check (guest_count > 0 and guest_count <= 100000),
  menu_id uuid references public.menus(id) on delete set null,
  menu_title_snapshot text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'planned', 'in_progress', 'completed', 'cancelled')),
  notes text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.production_events(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  recipe_title text not null,
  recipe_type text not null check (recipe_type in ('final', 'intermediate')),
  production_date date not null,
  quantity_factor numeric not null default 1 check (quantity_factor > 0),
  quantity_label text not null default '',
  recipe_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, recipe_id)
);

create index if not exists production_events_date_idx
  on public.production_events (event_date, status);
create index if not exists production_tasks_date_status_idx
  on public.production_tasks (production_date, status);
create index if not exists production_tasks_event_order_idx
  on public.production_tasks (event_id, production_date, sort_order);

create or replace function public.set_production_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_events_updated_at on public.production_events;
create trigger production_events_updated_at
before update on public.production_events
for each row execute function public.set_production_updated_at();

drop trigger if exists production_tasks_updated_at on public.production_tasks;
create trigger production_tasks_updated_at
before update on public.production_tasks
for each row execute function public.set_production_updated_at();

alter table public.production_events enable row level security;
alter table public.production_tasks enable row level security;

drop policy if exists "Active users can read production events" on public.production_events;
create policy "Active users can read production events"
on public.production_events for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true
));

drop policy if exists "Admins can insert production events" on public.production_events;
create policy "Admins can insert production events"
on public.production_events for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
) and created_by = auth.uid());

drop policy if exists "Admins can update production events" on public.production_events;
create policy "Admins can update production events"
on public.production_events for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
));

drop policy if exists "Admins can delete production events" on public.production_events;
create policy "Admins can delete production events"
on public.production_events for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
));

drop policy if exists "Active users can read production tasks" on public.production_tasks;
create policy "Active users can read production tasks"
on public.production_tasks for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true
));

drop policy if exists "Admins can insert production tasks" on public.production_tasks;
create policy "Admins can insert production tasks"
on public.production_tasks for insert to authenticated
with check (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
));

drop policy if exists "Admins can update production tasks" on public.production_tasks;
create policy "Admins can update production tasks"
on public.production_tasks for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
));

drop policy if exists "Admins can delete production tasks" on public.production_tasks;
create policy "Admins can delete production tasks"
on public.production_tasks for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = auth.uid() and p.active = true and p.role = 'admin'
));

grant select, insert, update, delete on public.production_events to authenticated;
grant select, insert, update, delete on public.production_tasks to authenticated;
