import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Falta configurar el servidor. Contacta con la administradora técnica." },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: requester, error: requesterError } = await adminClient
    .from("profiles")
    .select("role,active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (requesterError || !requester || requester.role !== "admin" || !requester.active) {
    return NextResponse.json({ error: "No tienes permisos para crear usuarios." }, { status: 403 });
  }

  let body: { full_name?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (fullName.length < 2 || fullName.length > 120) {
    return NextResponse.json({ error: "Introduce el nombre y apellidos." }, { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Introduce un correo electrónico válido." }, { status: 400 });
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "employee" },
    redirectTo: "https://lapartida.vercel.app/change-password",
  });

  if (inviteError || !invited.user) {
    const message = inviteError?.message.toLowerCase().includes("already")
      ? "Ya existe una cuenta con ese correo."
      : "No se ha podido enviar la invitación. Comprueba la configuración de correo de Supabase.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      user_id: invited.user.id,
      full_name: fullName,
      role: "employee",
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    return NextResponse.json(
      { error: "La cuenta se ha creado, pero no se ha podido configurar el perfil. Contacta con soporte técnico." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, message: "Invitación enviada al correo del empleado." });
}


async function getAdminClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return { error: NextResponse.json({ error: "Falta configurar el servidor." }, { status: 500 }) };
  }
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "La sesión no es válida." }, { status: 401 }) };
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: requester, error: requesterError } = await adminClient.from("profiles").select("role,active").eq("user_id", data.user.id).maybeSingle();
  if (requesterError || !requester || requester.role !== "admin" || !requester.active) {
    return { error: NextResponse.json({ error: "Solo una administradora activa puede gestionar el equipo." }, { status: 403 }) };
  }
  return { adminClient, requesterId: data.user.id };
}

export async function GET(request: NextRequest) {
  const auth = await getAdminClient(request);
  if ("error" in auth) return auth.error;
  const { data: profiles, error } = await auth.adminClient.from("profiles")
    .select("user_id,full_name,role,active,updated_at")
    .order("full_name", { ascending: true });
  if (error) return NextResponse.json({ error: "No se pudo cargar el equipo." }, { status: 500 });
  const { data: users, error: usersError } = await auth.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return NextResponse.json({ error: "No se pudieron cargar los correos del equipo." }, { status: 500 });
  const emailById = new Map((users.users || []).map(user => [user.id, user.email || ""]));
  return NextResponse.json({ employees: (profiles || []).map(profile => ({ ...profile, email: emailById.get(profile.user_id) || "" })) });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAdminClient(request);
  if ("error" in auth) return auth.error;
  let body: { user_id?: unknown; active?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Indica el empleado y el estado que quieres aplicar." }, { status: 400 });
  }
  if (userId === auth.requesterId) return NextResponse.json({ error: "No puedes desactivar tu propia cuenta." }, { status: 400 });
  const { data: target, error: targetError } = await auth.adminClient.from("profiles").select("user_id,role").eq("user_id", userId).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "No se ha encontrado esa cuenta." }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "Por seguridad, esta pantalla solo permite gestionar cuentas de empleados." }, { status: 400 });
  const { error } = await auth.adminClient.from("profiles").update({ active: body.active, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "No se pudo actualizar el estado del empleado." }, { status: 500 });
  return NextResponse.json({ success: true, message: body.active ? "Empleado reactivado." : "Empleado desactivado." });
}
