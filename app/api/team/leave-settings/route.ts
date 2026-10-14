import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !service) return NextResponse.json({ error: "Falta configurar el servidor." }, { status: 500 });
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "La sesión no es válida." }, { status: 401 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("role,active,user_id").eq("user_id", data.user.id).maybeSingle();
  if (!profile?.active) return NextResponse.json({ error: "La cuenta no está activa." }, { status: 403 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Solo administración puede cambiar la política de vacaciones." }, { status: 403 });
  let body: { counting_method?: unknown; annual_entitlement?: unknown; leave_year_start_month?: unknown; allow_carryover?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 }); }
  const method = body.counting_method;
  const entitlement = body.annual_entitlement === "" || body.annual_entitlement === null ? null : Number(body.annual_entitlement);
  const month = Number(body.leave_year_start_month);
  if (!["working_days","calendar_days"].includes(String(method)) ||
      (entitlement !== null && (!Number.isFinite(entitlement) || entitlement < 0 || entitlement > 366)) ||
      !Number.isInteger(month) || month < 1 || month > 12 || typeof body.allow_carryover !== "boolean") {
    return NextResponse.json({ error: "Revisa el método, los días anuales y el inicio del año de vacaciones." }, { status: 400 });
  }
  const { data: settings, error: saveError } = await admin.from("company_leave_settings").upsert({
    id: true, counting_method: method, annual_entitlement: entitlement, leave_year_start_month: month,
    allow_carryover: body.allow_carryover, updated_by: profile.user_id, updated_at: new Date().toISOString()
  }).select("*").single();
  if (saveError) return NextResponse.json({ error: "No se pudo guardar la política de vacaciones." }, { status: 500 });
  return NextResponse.json({ settings });
}
