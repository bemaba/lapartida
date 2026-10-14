"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Session, createClient } from "@supabase/supabase-js";
import { ChefHat, Mail, UserPlus, UserRound, UserX, UserCheck, UsersRound } from "lucide-react";
import AppHeader from "@/components/app-header";
import ModuleNavigation from "@/components/module-navigation";

type Profile = { user_id: string; full_name: string; email: string; role: "admin" | "employee"; active: boolean };
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function TeamPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{full_name:string;role:"admin"|"employee";active:boolean}|null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({data}) => { if (alive) { setSession(data.session); if (!data.session) setLoading(false); } });
    const {data: listener} = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) setLoading(false); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const request = useCallback(async (method: string, body?: object) => {
    if (!session?.access_token) throw new Error("Inicia sesión de nuevo para continuar.");
    const response = await fetch("/api/admin/users", { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? {"Content-Type":"application/json"} : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
    return result;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session || !supabase) return;
    setLoading(true);
    const {data: p} = await supabase.from("profiles").select("full_name,role,active").eq("user_id", session.user.id).maybeSingle();
    setProfile(p);
    if (p?.role === "admin" && p.active) {
      try { const result = await request("GET"); setEmployees(result.employees || []); }
      catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo cargar el equipo."); }
    }
    setLoading(false);
  }, [session, request]);

  useEffect(() => { if (session) void refresh(); else { setProfile(null); setEmployees([]); } }, [session, refresh]);

  const invite = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const result = await request("POST", {full_name: fullName, email});
      setNotice(result.message || "Invitación enviada.");
      setFullName(""); setEmail("");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo enviar la invitación."); }
    finally { setSaving(false); }
  };

  const toggleActive = async (employee: Profile) => {
    const action = employee.active ? "desactivar" : "reactivar";
    if (!window.confirm(`¿Quieres ${action} la cuenta de ${employee.full_name}?${employee.active ? " Ya no podrá acceder a La Partida." : ""}`)) return;
    setSaving(true); setNotice("");
    try { const result = await request("PATCH", {user_id: employee.user_id, active: !employee.active}); setNotice(result.message || "Estado actualizado."); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo actualizar la cuenta."); }
    finally { setSaving(false); }
  };

  if (!supabase) return <main className="lp-page"><section className="lp-card lp-login"><ChefHat/><h1>La Partida</h1><p>Falta configurar la conexión con Supabase.</p></section></main>;
  if (loading && !profile) return <main className="lp-page"><div className="lp-loading">Cargando equipo…</div></main>;
  if (!session) return <main className="lp-page"><section className="lp-card lp-login"><h1>Equipo</h1><p>Inicia sesión en La Partida para continuar.</p><a className="lp-button lp-primary" href="/">Volver al inicio</a></section></main>;
  if (!profile?.active || profile.role !== "admin") return <main className="lp-page"><AppHeader fullName={profile?.full_name || session.user.email || "Usuario"} role={profile?.role || "employee"} onLogout={() => { void supabase.auth.signOut(); window.location.href="/"; }}/><ModuleNavigation activeModule="equipo"/><div className="lp-content"><section className="lp-card"><h1>Acceso restringido</h1><p>Solo una administradora activa puede gestionar el equipo.</p></section></div></main>;

  const staff = employees.filter(employee => employee.role === "employee");
  const activeCount = staff.filter(employee => employee.active).length;
  return <main className="lp-page lp-team-page">
    <AppHeader fullName={profile.full_name || session.user.email || "Usuario"} role={profile.role} onLogout={() => { void supabase.auth.signOut(); window.location.href="/"; }}/>
    <ModuleNavigation activeModule="equipo"/>
    <div className="lp-content lp-team-content">
      <header className="lp-heading"><div><span className="lp-kicker">ORGANIZACIÓN DE COCINA</span><h1>Equipo</h1><p>Invita empleados y gestiona quién tiene acceso a La Partida.</p></div></header>
      {notice && <div className="lp-notice" role="status">{notice}</div>}
      <div className="lp-team-summary"><div className="lp-card lp-team-stat"><UsersRound size={22}/><div><strong>{activeCount}</strong><span>Empleados activos</span></div></div><div className="lp-card lp-team-stat"><UserX size={22}/><div><strong>{staff.length-activeCount}</strong><span>Cuentas desactivadas</span></div></div></div>
      <section className="lp-card lp-team-invite"><div className="lp-card-title"><div><span className="lp-kicker">NUEVA INCORPORACIÓN</span><h2>Invitar a un empleado</h2></div><UserPlus size={22}/></div><p>Le enviaremos un correo para acceder y configurar su contraseña.</p>
        <form className="lp-team-invite-form" onSubmit={invite}><label>Nombre y apellidos<input required minLength={2} maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Ej. Ana García"/></label><label>Correo electrónico<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="ana@empresa.com"/></label><button className="lp-button lp-primary" type="submit" disabled={saving}><Mail size={16}/>{saving ? "Procesando…" : "Enviar invitación"}</button></form>
      </section>
      <section className="lp-card lp-team-list"><div className="lp-card-title"><div><span className="lp-kicker">PERSONAL</span><h2>Personas del equipo</h2></div><span className="lp-team-count">{employees.length}</span></div>
        {loading ? <p className="lp-muted">Actualizando equipo…</p> : employees.length === 0 ? <div className="lp-team-empty"><UserRound size={28}/><strong>Aún no hay empleados</strong><span>Invita a la primera persona desde el formulario.</span></div> : <div className="lp-team-table-wrap"><table className="lp-team-table"><thead><tr><th>Empleado</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.user_id}><td><div className="lp-team-person"><span className="lp-team-avatar">{employee.full_name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "E"}</span><span><strong>{employee.full_name}</strong><small>{employee.email || "Correo no disponible"}</small></span></div></td><td><span className={`lp-team-status ${employee.active ? "active" : "inactive"}`}>{employee.active ? "Activo" : "Desactivado"}</span></td><td>{employee.role === "admin" ? <span className="lp-muted">Administración</span> : <button type="button" className="lp-button lp-secondary lp-team-action" disabled={saving} onClick={()=>void toggleActive(employee)}>{employee.active ? <><UserX size={14}/> Desactivar</> : <><UserCheck size={14}/> Reactivar</>}</button>}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="lp-team-footnote">Las cuentas desactivadas se conservan para mantener el historial. La planificación de horarios y el seguimiento del equipo se podrán añadir más adelante.</p>
    </div>
  </main>;
}
