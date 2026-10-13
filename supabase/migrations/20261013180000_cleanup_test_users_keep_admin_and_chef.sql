-- Limpieza controlada de cuentas y datos de prueba.
-- Conserva únicamente adminlapartida@gmail.com y pauchulirodriguezsanz@gmail.com, ambas con rol admin.
-- Requiere que ambas cuentas existan; falla sin cambios si falta cualquiera.
-- La migración se aplica en una transacción por Supabase CLI.

do $$
declare
  v_admin_id uuid;
  v_chef_id uuid;
begin
  select id into v_admin_id
  from auth.users
  where lower(email) = lower('adminlapartida@gmail.com');

  select id into v_chef_id
  from auth.users
  where lower(email) = lower('pauchulirodriguezsanz@gmail.com');

  if v_admin_id is null then
    raise exception 'Safety stop: no existe adminlapartida@gmail.com. No se ha limpiado ningún dato.';
  end if;

  if v_chef_id is null then
    raise exception 'Safety stop: no existe pauchulirodriguezsanz@gmail.com. No se ha limpiado ningún dato.';
  end if;

  if v_admin_id = v_chef_id then
    raise exception 'Safety stop: las dos direcciones deben corresponder a cuentas distintas.';
  end if;

  -- Asegurar que los dos perfiles existen y establecer el nombre visible y el rol.
  insert into public.profiles (user_id, full_name, role, active)
  values (v_admin_id, 'Administrador Técnico', 'admin', true)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        active = true,
        updated_at = now();

  insert into public.profiles (user_id, full_name, role, active)
  values (v_chef_id, 'Jefa de Cocina', 'admin', true)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        active = true,
        updated_at = now();

  -- Eliminar datos de fichaje/prueba, sin borrar tablas, funciones ni permisos.
  delete from public.breaks;
  delete from public.time_entries;
  delete from public.shifts;
  delete from public.audit_log;

  -- Conservar las recetas existentes, incluso si fueron creadas por cuentas que se van a eliminar.
  -- Reasignar su autoría al administrador evita que la FK ON DELETE CASCADE las borre.
  update public.recipes
  set created_by = v_admin_id,
      published_by = case
        when published_by is not null and published_by not in (v_admin_id, v_chef_id)
          then v_admin_id
        else published_by
      end,
      updated_at = now()
  where created_by not in (v_admin_id, v_chef_id)
     or (published_by is not null and published_by not in (v_admin_id, v_chef_id));

  -- Eliminar las demás cuentas de autenticación. Sus perfiles se eliminan por ON DELETE CASCADE.
  delete from auth.users
  where id not in (v_admin_id, v_chef_id);

  -- Sincronizar también los metadatos visibles de autenticación.
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('full_name', 'Administrador Técnico')
  where id = v_admin_id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('full_name', 'Jefa de Cocina')
  where id = v_chef_id;
end;
$$;
