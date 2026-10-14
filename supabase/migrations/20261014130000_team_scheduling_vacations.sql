-- Scheduling and leave management for La Partida.
create table if not exists public.scheduled_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  shift_date date not null,
  starts_at time without time zone not null,
  ends_at time without time zone not null,
  ends_next_day boolean not null default false,
  shift_type text not null default 'continuous' check (shift_type in ('continuous','split','variable')),
  notes text not null default '',
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at <> ends_at),
  check (char_length(notes) <= 500)
);
create index if not exists scheduled_shifts_date_idx on public.scheduled_shifts (shift_date, user_id, starts_at);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  leave_type text not null default 'vacation' check (leave_type in ('vacation','personal','other')),
  notes text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(user_id),
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (char_length(notes) <= 1000),
  check (char_length(review_note) <= 500)
);
create index if not exists leave_requests_dates_idx on public.leave_requests (starts_on, ends_on, status);
create index if not exists leave_requests_user_idx on public.leave_requests (user_id, starts_on desc);

create table if not exists public.company_leave_settings (
  id boolean primary key default true check (id),
  counting_method text not null default 'working_days' check (counting_method in ('working_days','calendar_days')),
  annual_entitlement numeric(6,2),
  leave_year_start_month smallint not null default 1 check (leave_year_start_month between 1 and 12),
  allow_carryover boolean not null default false,
  updated_by uuid references public.profiles(user_id),
  updated_at timestamptz not null default now(),
  check (annual_entitlement is null or annual_entitlement >= 0)
);
insert into public.company_leave_settings (id) values (true) on conflict (id) do nothing;

alter table public.scheduled_shifts enable row level security;
alter table public.leave_requests enable row level security;
alter table public.company_leave_settings enable row level security;

drop policy if exists "Active team reads scheduled shifts" on public.scheduled_shifts;
create policy "Active team reads scheduled shifts" on public.scheduled_shifts
for select to authenticated using (
  exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.active = true)
);
drop policy if exists "Admins manage scheduled shifts" on public.scheduled_shifts;
create policy "Admins manage scheduled shifts" on public.scheduled_shifts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Employees read own leave and team approved leave" on public.leave_requests;
create policy "Employees read own leave and team approved leave" on public.leave_requests
for select to authenticated using (
  public.is_admin()
  or user_id = (select auth.uid())
  or (status = 'approved' and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.active = true
  ))
);
drop policy if exists "Employees create own leave requests" on public.leave_requests;
create policy "Employees create own leave requests" on public.leave_requests
for insert to authenticated with check (
  user_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.active = true)
);
drop policy if exists "Employees cancel own pending leave" on public.leave_requests;
create policy "Employees cancel own pending leave" on public.leave_requests
for update to authenticated using (
  user_id = (select auth.uid()) and status = 'pending'
) with check (
  user_id = (select auth.uid()) and status = 'cancelled'
);
drop policy if exists "Admins manage leave requests" on public.leave_requests;
create policy "Admins manage leave requests" on public.leave_requests
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Active team reads company leave settings" on public.company_leave_settings;
create policy "Active team reads company leave settings" on public.company_leave_settings
for select to authenticated using (
  exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.active = true)
);
drop policy if exists "Admins manage company leave settings" on public.company_leave_settings;
create policy "Admins manage company leave settings" on public.company_leave_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.scheduled_shifts to authenticated;
grant select, insert, update, delete on public.leave_requests to authenticated;
grant select, insert, update on public.company_leave_settings to authenticated;
grant all on public.scheduled_shifts to service_role;
grant all on public.leave_requests to service_role;
grant all on public.company_leave_settings to service_role;
