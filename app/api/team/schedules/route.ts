import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !service) return { response: NextResponse.json({ error: "Falta configurar el servidor." }, { status: 500 }) };
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { response: NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 }) };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { response: NextResponse.json({ error: "La sesión no es válida." }, { status: 401 }) };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("profiles").select("user_id,full_name,role,active").eq("user_id", data.user.id).maybeSingle();
  if (profileError || !profile || !profile.active) return { response: NextResponse.json({ error: "La cuenta no está activa." }, { status: 403 }) };
  return { admin, user: profile };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return NextResponse.json({ error: "Indica una semana válida." }, { status: 400 });
  }
  const { data: employees, error: employeesError } = await auth.admin.from("profiles")
    .select("user_id,full_name,role,active").eq("active", true).order("full_name");
  if (employeesError) return NextResponse.json({ error: "No se pudo cargar el equipo." }, { status: 500 });
  const { data: shifts, error } = await auth.admin.from("scheduled_shifts").select("*").gte("shift_date", from).lte("shift_date", to).order("starts_at");
  if (error) return NextResponse.json({ error: "No se pudieron cargar los horarios. ¿Está aplicada la migración?" }, { status: 500 });
  return NextResponse.json({ employees: employees || [], shifts: shifts || [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Solo administración puede editar horarios." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const date = typeof body.shift_date === "string" ? body.shift_date : "";
  const start = typeof body.starts_at === "string" ? body.starts_at : "";
  const end = typeof body.ends_at === "string" ? body.ends_at : "";
  const type = body.shift_type;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const overnight = body.ends_next_day === true;
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end || !["continuous","split","variable"].includes(String(type)) || notes.length > 500) {
    return NextResponse.json({ error: "Revisa la fecha, el tipo de jornada y las horas." }, { status: 400 });
  }
  const { data: target, error: targetError } = await auth.admin.from("profiles").select("user_id").eq("user_id", userId).eq("active", true).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "El empleado no existe o está inactivo." }, { status: 400 });
  const { data, error } = await auth.admin.from("scheduled_shifts").insert({
    user_id: userId, shift_date: date, starts_at: start, ends_at: end, ends_next_day: overnight,
    shift_type: type, notes, created_by: auth.user.user_id
  }).select("*").single();
  if (error) return NextResponse.json({ error: "No se pudo guardar el turno." }, { status: 500 });
  return NextResponse.json({ shift: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Solo administración puede editar horarios." }, { status: 403 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Indica el turno." }, { status: 400 });
  const { error } = await auth.admin.from("scheduled_shifts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar el turno." }, { status: 500 });
  return NextResponse.json({ success: true });
}
