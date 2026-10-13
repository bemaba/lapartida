"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { ChefHat, Clock3, Play, Pause, Square, Users, Download, ShieldCheck, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, AlertCircle, FileSpreadsheet, Pencil, Save, X, BookOpen, Utensils, UsersRound, Package } from "lucide-react";
import ModuleNavigation from "@/components/module-navigation";
import AppHeader from "@/components/app-header";
import { appModules } from "@/lib/modules";

type Profile = { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean };
type Entry = { id: string; user_id: string; clock_in: string; clock_out: string | null; employee_name?: string; breaks?: BreakRow[] | null };
type BreakRow = { id: string; time_entry_id: string; started_at: string; ended_at: string | null };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;
function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
}
function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
}
function toDateTimeLocal(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(value));
}
function getWeekBounds(offset: number) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - day + offset * 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return { start: monday, end: nextMonday };
}
function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function calculateEntryMinutes(record: Entry, now = Date.now()) {
  const end = record.clock_out ? new Date(record.clock_out).getTime() : now;
  const gross = Math.max(0, (end - new Date(record.clock_in).getTime()) / 60000);
  const pause = (record.breaks || []).reduce((total, item) => {
    const pauseEnd = item.ended_at ? new Date(item.ended_at).getTime() : (record.clock_out ? new Date(record.clock_out).getTime() : now);
    return total + Math.max(0, (pauseEnd - new Date(item.started_at).getTime()) / 60000);
  }, 0);
  return Math.max(0, Math.round(gross - pause));
}
function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export default function Home() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [activeBreak, setActiveBreak] = useState<BreakRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weeklyEntries, setWeeklyEntries] = useState<Entry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [employeeHistory, setEmployeeHistory] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tab, setTab] = useState<"jornada" | "equipo" | "fichajes">("jornada");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setNotice(error.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!supabase || !session?.user) return;
    const { data: p, error: profileError } = await supabase
      .from("profiles").select("user_id,full_name,role,active").eq("user_id", session.user.id).maybeSingle();
    if (profileError) { setNotice("No se pudo cargar el perfil: " + profileError.message); return; }
    setProfile(p as Profile | null);
    if (!p) { setNotice("Tu usuario no tiene perfil. Comprueba que se haya creado en Supabase."); return; }
    if (p.role === "admin") {
      const bounds = getWeekBounds(weekOffset);
      const [peopleResult, entriesResult, weeklyResult] = await Promise.all([
        supabase.from("profiles").select("user_id,full_name,role,active").order("full_name"),
        supabase.from("time_entries").select("id,user_id,clock_in,clock_out").order("clock_in", { ascending: false }).limit(200),
        supabase.from("time_entries").select("id,user_id,clock_in,clock_out,breaks(id,time_entry_id,started_at,ended_at)")
          .gte("clock_in", bounds.start.toISOString()).lt("clock_in", bounds.end.toISOString()).order("clock_in", { ascending: true })
      ]);
      if (peopleResult.error) setNotice("No se pudo cargar el equipo: " + peopleResult.error.message);
      else setProfiles((peopleResult.data || []) as Profile[]);
      const namesByUserId = new Map((peopleResult.data || []).map((person: any) => [person.user_id, person.full_name]));
      if (entriesResult.error) setNotice("No se pudieron cargar los fichajes: " + entriesResult.error.message);
      else setEntries((entriesResult.data || []).map((record: any) => ({ ...record, employee_name: namesByUserId.get(record.user_id) || "" })) as Entry[]);
      if (weeklyResult.error) setNotice("No se pudo cargar el resumen semanal: " + weeklyResult.error.message);
      else setWeeklyEntries((weeklyResult.data || []).map((record: any) => ({ ...record, employee_name: namesByUserId.get(record.user_id) || "" })) as Entry[]);
    }
    const { data: historyData, error: historyError } = await supabase
      .from("time_entries")
      .select("id,user_id,clock_in,clock_out,breaks(id,time_entry_id,started_at,ended_at)")
      .eq("user_id", session.user.id)
      .order("clock_in", { ascending: false })
      .limit(30);
    if (historyError) setNotice("No se pudo cargar tu histórico: " + historyError.message);
    else setEmployeeHistory((historyData || []) as Entry[]);

    const { data: openEntry, error: entryError } = await supabase.from("time_entries")
      .select("id,user_id,clock_in,clock_out").eq("user_id", session.user.id).is("clock_out", null).maybeSingle();
    if (entryError) { setNotice("No se pudo consultar tu jornada: " + entryError.message); return; }
    setEntry(openEntry as Entry | null);
    if (openEntry) {
      const { data: openPause, error: breakError } = await supabase.from("breaks")
        .select("id,time_entry_id,started_at,ended_at").eq("time_entry_id", openEntry.id).is("ended_at", null).maybeSingle();
      if (breakError) setNotice("No se pudo consultar la pausa: " + breakError.message);
      setActiveBreak(openPause as BreakRow | null);
    } else setActiveBreak(null);
  }, [supabase, session, weekOffset]);

  useEffect(() => { if (session) void refresh(); else { setProfile(null); setEntry(null); setActiveBreak(null); setEntries([]); setWeeklyEntries([]); setEmployeeHistory([]); setProfiles([]); } }, [session, refresh]);

// Fichaje queda oculto temporalmente; la pantalla inicial muestra solo los módulos activos.
  const doLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setNotice("No se ha podido iniciar sesión. Revisa el correo y la contraseña.");
    setBusy(false);
  };
  const doLogout = async () => { if (supabase) await supabase.auth.signOut(); setNotice("Sesión cerrada."); };
  const startEditEntry = (record: Entry) => {
    if (!record.clock_out || profile?.role !== "admin") return;
    setEditingEntry(record);
    setEditClockIn(toDateTimeLocal(record.clock_in));
    setEditClockOut(toDateTimeLocal(record.clock_out));
    setNotice("");
  };
  const saveEntryEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingEntry || !session?.access_token || profile?.role !== "admin") return;
    const clockIn = new Date(editClockIn);
    const clockOut = new Date(editClockOut);
    if (!editClockIn || !editClockOut || !Number.isFinite(clockIn.getTime()) || !Number.isFinite(clockOut.getTime()) || clockOut <= clockIn) {
      setNotice("La salida debe ser posterior a la entrada.");
      return;
    }
    setSavingEntry(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/time-entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: editingEntry.id, clock_in: clockIn.toISOString(), clock_out: clockOut.toISOString() }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error || "No se ha podido corregir el fichaje.");
      } else {
        setNotice("Fichaje cerrado actualizado correctamente.");
        setEditingEntry(null);
        await refresh();
      }
    } catch {
      setNotice("No se ha podido conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setSavingEntry(false);
    }
  };
  const createEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!session?.access_token) return;
    setCreatingEmployee(true); setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ full_name: newEmployeeName, email: newEmployeeEmail }),
      });
      const result = await response.json();
      if (!response.ok) setNotice(result.error || "No se ha podido crear el usuario.");
      else {
        setNotice(result.message || "Invitación enviada.");
        setNewEmployeeName(""); setNewEmployeeEmail("");
        await refresh();
      }
    } catch {
      setNotice("No se ha podido conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setCreatingEmployee(false);
    }
  };
  const runAction = async (action: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    setBusy(true); setNotice("");
    const result = await action();
    if (result.error) setNotice("No se ha podido completar la acción: " + result.error.message);
    else { setNotice(success); await refresh(); }
    setBusy(false);
  };
  const clockIn = () => {
    if (!supabase || !session) return;
    void runAction(() => supabase.rpc("clock_in"), "Entrada registrada correctamente.");
  };
  const clockOut = () => {
    if (!supabase || !entry) return;
    void runAction(() => supabase.rpc("clock_out"), "Salida registrada correctamente.");
  };
  const startBreak = () => {
    if (!supabase || !entry) return;
    void runAction(() => supabase.rpc("start_break"), "Pausa iniciada.");
  };
  const endBreak = () => {
    if (!supabase || !activeBreak) return;
    void runAction(() => supabase.rpc("end_break"), "Pausa finalizada.");
  };
  const exportCsv = () => {
    const rows = [["Empleado", "Entrada", "Salida"], ...entries.map(e => [e.employee_name || e.user_id, formatDate(e.clock_in), formatDate(e.clock_out)])];
    const csv = rows.map(row => row.map(v => '"' + v.replaceAll('"', '""') + '"').join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "la-partida-fichajes.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const formatDuration = (start: string, end: string | null, pauses: BreakRow[] = []) => {
    if (!end) return "En curso";
    const grossMinutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
    const pauseMinutes = pauses.reduce((total, pause) => {
      if (!pause.ended_at) return total;
      return total + (new Date(pause.ended_at).getTime() - new Date(pause.started_at).getTime()) / 60000;
    }, 0);
    const minutes = Math.max(0, Math.round(grossMinutes - pauseMinutes));
    return String(Math.floor(minutes / 60)) + " h " + String(minutes % 60).padStart(2, "0") + " min";
  };
  const weekBounds = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(weekBounds.start);
    const end = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(weekBounds.end.getTime() - 1));
    return `${start} – ${end}`;
  }, [weekBounds]);
  const weeklyEmployeeCount = useMemo(() => new Set(weeklyEntries.map(item => item.user_id)).size, [weeklyEntries]);
  const weeklyMinutes = useMemo(() => weeklyEntries.reduce((total, item) => total + calculateEntryMinutes(item), 0), [weeklyEntries]);
  const completedWeekCount = useMemo(() => weeklyEntries.filter(item => item.clock_out).length, [weeklyEntries]);
  const openWeekCount = useMemo(() => weeklyEntries.filter(item => !item.clock_out).length, [weeklyEntries]);
  const weeklyByEmployee = useMemo(() => {
    const grouped = new Map<string, { userId: string; name: string; shifts: number; minutes: number; open: number }>();
    weeklyEntries.forEach(item => {
      const current = grouped.get(item.user_id) || { userId: item.user_id, name: item.employee_name || "Empleado sin nombre", shifts: 0, minutes: 0, open: 0 };
      current.shifts += 1;
      current.minutes += calculateEntryMinutes(item);
      if (!item.clock_out) current.open += 1;
      grouped.set(item.user_id, current);
    });
    return Array.from(grouped.values()).sort((a, b) => b.minutes - a.minutes);
  }, [weeklyEntries]);
  const exportWeeklyCsv = () => {
    const rows = [["Empleado", "Jornadas", "Horas netas", "Jornadas abiertas"], ...weeklyByEmployee.map(person => [person.name, String(person.shifts), formatMinutes(person.minutes), String(person.open)])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll("\"", "\"\"")}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `la-partida-resumen-semanal-${dateKey(weekBounds.start)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (session && !profile && !loading) return <main className="lp-center"><section className="lp-card lp-config"><ChefHat size={26}/><h1>La Partida</h1><p>{notice || "Cargando tu perfil…"}</p></section></main>;
  if (session && profile && !profile.active) return <main className="lp-center"><section className="lp-card lp-config"><ChefHat size={26}/><h1>Cuenta desactivada</h1><p>Contacta con la administradora de La Partida.</p></section></main>;
  if (session && profile?.active) {
    const moduleIcons = { fichaje: Clock3, recetas: BookOpen, menus: Utensils, eventos: CalendarDays, equipo: UsersRound, compras: Package };
    const moduleRoutes: Record<string, string> = { fichaje: "/", recetas: "/recetas", menus: "/menus", eventos: "/eventos", equipo: "/equipo", compras: "/compras" };
    const activeModules = appModules.filter(module => module.enabled);
    return <main className="lp-home-screen">
      <AppHeader fullName={profile.full_name || session.user.email || "Usuario"} role={profile.role} onLogout={() => void doLogout()} />
      <section className="lp-home-content">
        <div className="lp-home-intro"><div className="lp-logo"><ChefHat size={28}/></div><div className="lp-kicker">ESPACIO DE TRABAJO</div><h1>La Partida</h1><p>Gestión de cocina, en un solo lugar.</p></div>
        <div className="lp-home-modules" aria-label="Módulos activos">
          {activeModules.map(module => { const Icon = moduleIcons[module.icon]; return <Link key={module.id} href={moduleRoutes[module.id] || "/"} className="lp-home-module-card"><span className="lp-home-module-icon"><Icon size={30}/></span><strong>{module.label}</strong><span>{module.description}</span><span className="lp-home-module-action">Abrir módulo <span aria-hidden="true">→</span></span></Link>; })}
        </div>
        <p className="lp-home-footnote">Selecciona un módulo para empezar.</p>
      </section>
    </main>;
  }
  if (!supabase) return <main className="lp-center"><section className="lp-card lp-config"><div className="lp-logo"><ChefHat size={25}/></div><h1>La Partida</h1><p>Falta configurar la conexión con Supabase.</p><p className="lp-muted">Añade la URL del proyecto y la clave pública en las variables de entorno de Vercel y vuelve a desplegar.</p></section></main>;
  if (loading) return <main className="lp-center"><div className="lp-card"><ChefHat/><p>Cargando La Partida…</p></div></main>;
  if (!session) return <main className="lp-center"><section className="lp-card lp-login"><div className="lp-logo"><ChefHat size={26}/></div><div className="lp-kicker">GESTIÓN DE COCINA</div><h1>La Partida</h1><p className="lp-muted">Inicia sesión para consultar las recetas y gestionar los menús.</p><form onSubmit={doLogin} className="lp-form"><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña"/></label><button className="lp-button lp-primary" disabled={busy}>{busy ? "Entrando…" : "Iniciar sesión"}</button></form>{notice && <p className="lp-notice">{notice}</p>}<p className="lp-forgot"><Link href="/forgot-password">¿Has olvidado tu contraseña?</Link></p><p className="lp-footnote">Acceso privado · Zona horaria Europe/Madrid</p></section></main>;

  return <main className="lp-app">
    <AppHeader fullName={profile?.full_name || session.user.email || "Usuario"} role={profile?.role || "employee"} onLogout={() => void doLogout()} />
    <ModuleNavigation activeModule="fichaje" />
    <div className="lp-content"><div className="lp-heading"><div><div className="lp-kicker">ESPACIO DE TRABAJO</div><h1>La Partida - Gestión de Cocina</h1><p>{profile?.role === "admin" ? "Consulta los fichajes y el estado del equipo." : "Registra tu entrada, tus pausas y tu salida."}</p></div><span className="lp-role"><ShieldCheck size={15}/>{profile?.role === "admin" ? "Administradora" : "Empleado"}</span></div>
      {notice && <div className="lp-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {!profile?.active && <div className="lp-notice">Tu cuenta está desactivada. Contacta con la administradora.</div>}
      {profile?.active && profile.role === "employee" && <><section className="lp-card lp-shift-card"><div className="lp-card-title"><div><span className="lp-kicker">ESTADO ACTUAL</span><h2>{!entry ? "No hay ninguna jornada abierta" : activeBreak ? "Estás en pausa" : "Jornada en curso"}</h2></div><span className={"lp-status " + (!entry ? "off" : activeBreak ? "break" : "on")}>{!entry ? "Fuera de jornada" : activeBreak ? "En pausa" : "Trabajando"}</span></div>{entry && <p className="lp-time-line">Entrada de esta jornada: <strong>{formatTime(entry.clock_in)}</strong></p>}<div className="lp-actions">{!entry ? <button className="lp-button lp-primary" onClick={clockIn} disabled={busy}><Play size={17}/> Fichar entrada</button> : <>{!activeBreak ? <button className="lp-button lp-secondary" onClick={startBreak} disabled={busy}><Pause size={17}/> Iniciar pausa</button> : <button className="lp-button lp-secondary" onClick={endBreak} disabled={busy}><Play size={17}/> Terminar pausa</button>}<button className="lp-button lp-danger" onClick={clockOut} disabled={busy}><Square size={15}/> Fichar salida</button></>}</div><p className="lp-muted small-text">Las horas se muestran en horario peninsular. Comprueba siempre que el registro sea correcto.</p></section><section className="lp-card lp-history-card"><div className="lp-card-title"><div><span className="lp-kicker">TUS REGISTROS</span><h2>Histórico de jornadas</h2></div><button className="lp-icon-button" onClick={() => void refresh()} title="Actualizar histórico"><span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>↻</span></button></div><p className="lp-muted small-text">Tus últimas 30 jornadas, ordenadas de la más reciente a la más antigua.</p><div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Duración</th><th>Pausas</th></tr></thead><tbody>{employeeHistory.map(h => <tr key={h.id}><td>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(h.clock_in))}</td><td>{formatTime(h.clock_in)}</td><td>{formatTime(h.clock_out)}</td><td>{formatDuration(h.clock_in, h.clock_out, h.breaks || [])}</td><td>{(h.breaks || []).length}</td></tr>)}</tbody></table>{!employeeHistory.length && <p className="lp-muted">Todavía no tienes jornadas registradas.</p>}</div></section></>}
      {profile?.role === "admin" && <><nav className="lp-tabs"><button className={tab === "jornada" ? "active" : ""} onClick={() => setTab("jornada")}><Clock3 size={16}/> Resumen</button><button className={tab === "equipo" ? "active" : ""} onClick={() => setTab("equipo")}><Users size={16}/> Equipo ({profiles.length})</button><button className={tab === "fichajes" ? "active" : ""} onClick={() => setTab("fichajes")}><Clock3 size={16}/> Fichajes</button></nav>{tab === "jornada" && <div className="lp-weekly-dashboard">
        <section className="lp-card lp-week-picker">
          <div><span className="lp-kicker">ACTIVIDAD DEL EQUIPO</span><h2>Resumen semanal</h2><p className="lp-muted small-text">Horas netas, descontando las pausas registradas.</p></div>
          <div className="lp-week-controls">
            <button className="lp-icon-button" onClick={() => setWeekOffset(value => value - 1)} title="Semana anterior" aria-label="Semana anterior"><ChevronLeft size={18}/></button>
            <div className="lp-week-label"><CalendarDays size={17}/><strong>{weekLabel}</strong>{weekOffset === 0 && <span>Esta semana</span>}</div>
            <button className="lp-icon-button" onClick={() => setWeekOffset(value => Math.min(0, value + 1))} title="Semana siguiente" aria-label="Semana siguiente" disabled={weekOffset === 0}><ChevronRight size={18}/></button>
          </div>
        </section>
        <div className="lp-week-stats">
          <section className="lp-card lp-week-stat"><span className="lp-week-stat-icon"><Users size={18}/></span><span className="lp-muted">Empleados con actividad</span><strong>{weeklyEmployeeCount}</strong><small>De {profiles.filter(person => person.active && person.role === "employee").length} empleados activos</small></section>
          <section className="lp-card lp-week-stat"><span className="lp-week-stat-icon"><Clock3 size={18}/></span><span className="lp-muted">Horas trabajadas</span><strong>{formatMinutes(weeklyMinutes)}</strong><small>Tiempo neto registrado</small></section>
          <section className="lp-card lp-week-stat"><span className="lp-week-stat-icon"><CheckCircle2 size={18}/></span><span className="lp-muted">Jornadas completadas</span><strong>{completedWeekCount}</strong><small>Con salida registrada</small></section>
          <section className="lp-card lp-week-stat"><span className="lp-week-stat-icon"><AlertCircle size={18}/></span><span className="lp-muted">Jornadas pendientes</span><strong>{openWeekCount}</strong><small>Sin salida registrada</small></section>
        </div>
        <section className="lp-card lp-week-employee-card">
          <div className="lp-card-title"><div><span className="lp-kicker">DETALLE POR PERSONA</span><h2>Actividad del equipo</h2></div><button className="lp-button lp-secondary" onClick={exportWeeklyCsv} disabled={!weeklyByEmployee.length}><FileSpreadsheet size={16}/> Exportar semana</button></div>
          <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Empleado</th><th>Jornadas</th><th>Horas netas</th><th>Estado</th></tr></thead><tbody>{weeklyByEmployee.map(person => <tr key={person.userId}><td>{person.name}</td><td>{person.shifts}</td><td>{formatMinutes(person.minutes)}</td><td>{person.open ? <span className="lp-status on">{person.open} abierta(s)</span> : <span className="lp-status off">Completadas</span>}</td></tr>)}</tbody></table>{!weeklyByEmployee.length && <div className="lp-week-empty"><CalendarDays size={24}/><strong>Sin actividad esta semana</strong><span>No hay fichajes en el periodo seleccionado.</span></div>}</div>
        </section>
      </div>}{tab === "equipo" && <section className="lp-card"><div className="lp-card-title"><h2>Equipo</h2></div>
        <form className="lp-create-user" onSubmit={createEmployee}>
          <div><span className="lp-kicker">NUEVA INCORPORACIÓN</span><h3>Añadir empleado</h3><p className="lp-muted small-text">Enviaremos una invitación para que configure su propia contraseña.</p></div>
          <label>Nombre y apellidos<input required minLength={2} maxLength={120} value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} placeholder="Nombre del empleado" /></label>
          <label>Correo electrónico<input required type="email" value={newEmployeeEmail} onChange={e => setNewEmployeeEmail(e.target.value)} placeholder="empleado@correo.com" /></label>
          <button className="lp-button lp-primary" disabled={creatingEmployee}>{creatingEmployee ? "Enviando…" : "Enviar invitación"}</button>
        </form>
        <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Usuario</th></tr></thead><tbody>{profiles.map(p => <tr key={p.user_id}><td>{p.full_name || "Sin nombre"}</td><td>{p.role === "admin" ? "Administradora" : "Empleado"}</td><td>{p.active ? "Activo" : "Desactivado"}</td><td className="lp-id">{p.user_id.slice(0, 8)}…</td></tr>)}</tbody></table></div><p className="lp-muted small-text">Las cuentas creadas aquí reciben el rol de empleado. La asignación de administradores se reserva para la administradora técnica.</p></section>}{tab === "fichajes" && <section className="lp-card"><div className="lp-card-title"><h2>Fichajes recientes</h2><button className="lp-button lp-secondary" onClick={exportCsv} disabled={!entries.length}><Download size={16}/> Exportar CSV</button></div>
        {editingEntry && <form className="lp-entry-edit-form" onSubmit={saveEntryEdit}><div><span className="lp-kicker">CORREGIR FICHAJE CERRADO</span><h3>{editingEntry.employee_name || "Empleado"} · {formatDate(editingEntry.clock_in)}</h3><p className="lp-muted small-text">Solo las administradoras pueden modificar jornadas finalizadas. La duración se recalculará automáticamente.</p></div><label>Entrada<input required type="datetime-local" value={editClockIn} onChange={e=>setEditClockIn(e.target.value)}/></label><label>Salida<input required type="datetime-local" value={editClockOut} onChange={e=>setEditClockOut(e.target.value)}/></label><div className="lp-entry-edit-actions"><button type="button" className="lp-button lp-secondary" onClick={()=>setEditingEntry(null)} disabled={savingEntry}><X size={15}/> Cancelar</button><button type="submit" className="lp-button lp-primary" disabled={savingEntry}><Save size={15}/>{savingEntry?"Guardando…":"Guardar cambios"}</button></div></form>}
        <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Empleado</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{e.employee_name || e.user_id.slice(0, 8) + "…"}</td><td>{formatDate(e.clock_in)}</td><td>{formatDate(e.clock_out)}</td><td><span className={"lp-status " + (e.clock_out ? "off" : "on")}>{e.clock_out ? "Finalizado" : "Abierto"}</span></td><td>{e.clock_out ? <button type="button" className="lp-button lp-secondary lp-entry-edit-button" onClick={()=>startEditEntry(e)}><Pencil size={14}/> Editar</button> : <span className="lp-muted small-text">En curso</span>}</td></tr>)}</tbody></table>{!entries.length && <p className="lp-muted">Todavía no hay fichajes.</p>}</div></section>}</>}
      <footer className="lp-footer">La Partida - Gestión de Cocina</footer>
    </div>
  </main>;
}
