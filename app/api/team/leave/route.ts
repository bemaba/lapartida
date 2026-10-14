import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

async function authorize(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !service) return { response: NextResponse.json({ error: "Falta configurar el servidor." }, { status: 500 }) };
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
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
  const { data: requests, error } = await auth.admin.from("leave_requests").select("*").order("starts_on", { ascending: true });
  if (error) return NextResponse.json({ error: "No se pudieron cargar las vacaciones. ¿Está aplicada la migración?" }, { status: 500 });
  const visible = (requests || []).filter(item => auth.user.role === "admin" || item.user_id === auth.user.user_id || item.status === "approved");
  const { data: settings } = await auth.admin.from("company_leave_settings").select("*").eq("id", true).maybeSingle();
  const { data: profiles } = await auth.admin.from("profiles").select("user_id,full_name").eq("active", true);
  return NextResponse.json({ requests: visible, settings: settings || null, employees: profiles || [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  let body: { starts_on?: unknown; ends_on?: unknown; leave_type?: unknown; notes?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const start = typeof body.starts_on === "string" ? body.starts_on : "";
  const end = typeof body.ends_on === "string" ? body.ends_on : "";
  const type = ["vacation","personal","other"].includes(String(body.leave_type)) ? String(body.leave_type) : "vacation";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || notes.length > 1000) {
    return NextResponse.json({ error: "Revisa las fechas y la nota de la solicitud." }, { status: 400 });
  }
  const { data: conflict, error: conflictError } = await auth.admin.from("leave_requests").select("id")
    .eq("user_id", auth.user.user_id).in("status", ["pending","approved"]).lte("starts_on", end).gte("ends_on", start).limit(1);
  if (conflictError) return NextResponse.json({ error: "No se pudo comprobar si ya tienes una solicitud en esas fechas." }, { status: 500 });
  if (conflict?.length) return NextResponse.json({ error: "Ya tienes una solicitud pendiente o aprobada que coincide con esas fechas." }, { status: 409 });
  const { data, error } = await auth.admin.from("leave_requests").insert({
    user_id: auth.user.user_id, starts_on: start, ends_on: end, leave_type: type, notes, status: "pending"
  }).select("*").single();
  if (error) return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  let body: { id?: unknown; status?: unknown; review_note?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status;
  const reviewNote = typeof body.review_note === "string" ? body.review_note.trim() : "";
  if (!id || !["approved","rejected","cancelled"].includes(String(status)) || reviewNote.length > 500) {
    return NextResponse.json({ error: "Indica una acción válida." }, { status: 400 });
  }
  const { data: current, error: currentError } = await auth.admin.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "No se ha encontrado la solicitud." }, { status: 404 });
  if (status === "cancelled") {
    if (current.user_id !== auth.user.user_id || current.status !== "pending") return NextResponse.json({ error: "Solo puedes cancelar tus propias solicitudes pendientes." }, { status: 403 });
    const { error } = await auth.admin.from("leave_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "No se pudo cancelar la solicitud." }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Solo administración puede aprobar o rechazar vacaciones." }, { status: 403 });
  if (current.status !== "pending") return NextResponse.json({ error: "Solo se pueden revisar solicitudes pendientes." }, { status: 409 });
  const { error } = await auth.admin.from("leave_requests").update({
    status, review_note: reviewNote, reviewed_by: auth.user.user_id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar la solicitud." }, { status: 500 });
  return NextResponse.json({ success: true });
}
