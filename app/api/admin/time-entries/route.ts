import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Falta configurar el servidor. Contacta con la administradora técnica." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });

  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: requester, error: requesterError } = await adminClient.from("profiles")
    .select("role,active").eq("user_id", authData.user.id).maybeSingle();
  if (requesterError || !requester || requester.role !== "admin" || !requester.active) {
    return NextResponse.json({ error: "No tienes permisos para corregir fichajes." }, { status: 403 });
  }

  let body: { id?: unknown; clock_in?: unknown; clock_out?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const clockIn = typeof body.clock_in === "string" ? new Date(body.clock_in) : null;
  const clockOut = typeof body.clock_out === "string" ? new Date(body.clock_out) : null;
  if (!id || id.length > 100 || !clockIn || !clockOut ||
      !Number.isFinite(clockIn.getTime()) || !Number.isFinite(clockOut.getTime()) || clockOut <= clockIn) {
    return NextResponse.json({ error: "Revisa las fechas: la salida debe ser posterior a la entrada." }, { status: 400 });
  }

  const { data: current, error: currentError } = await adminClient.from("time_entries")
    .select("id,clock_out").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "No se pudo consultar el fichaje." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "No se ha encontrado el fichaje." }, { status: 404 });
  if (!current.clock_out) return NextResponse.json({ error: "Solo se pueden editar jornadas ya cerradas." }, { status: 409 });

  const { data: updated, error: updateError } = await adminClient.from("time_entries")
    .update({ clock_in: clockIn.toISOString(), clock_out: clockOut.toISOString() })
    .eq("id", id).not("clock_out", "is", null).select("id").maybeSingle();
  if (updateError || !updated) {
    return NextResponse.json({ error: "No se pudo guardar la corrección. Actualiza la página e inténtalo de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Fichaje cerrado actualizado." });
}
