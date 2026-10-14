"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Session, createClient } from "@supabase/supabase-js";
import { CalendarDays, ChevronLeft, ChevronRight, Palmtree, Plus, Save, Trash2, Check, X, Settings2, Pencil } from "lucide-react";
import Link from "next/link";
import AppHeader from "@/components/app-header";
import ModuleNavigation from "@/components/module-navigation";

type Profile = { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean };
type Shift = { id: string; user_id: string; shift_date: string; starts_at: string; ends_at: string; ends_next_day: boolean; shift_type: "continuous" | "split" | "variable"; notes: string };
type LeaveRequest = { id: string; user_id: string; starts_on: string; ends_on: string; leave_type: "vacation" | "personal" | "other"; notes: string; status: "pending" | "approved" | "rejected" | "cancelled"; review_note: string };
type Settings = { counting_method: "working_days" | "calendar_days"; annual_entitlement: number | null; leave_year_start_month: number; allow_carryover: boolean };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const emptySettings: Settings = { counting_method: "working_days", annual_entitlement: null, leave_year_start_month: 1, allow_carryover: false };
function dateKey(date: Date) { return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0"); }
function mondayOf(date: Date) { const d = new Date(date.getFullYear(),date.getMonth(),date.getDate()); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
function addDays(date: Date, amount: number) { const d = new Date(date); d.setDate(d.getDate()+amount); return d; }
function dayLabel(value: string) { return new Intl.DateTimeFormat("es-ES",{weekday:"short",day:"2-digit",month:"2-digit"}).format(new Date(value+"T12:00:00")); }
function longDate(value: string) { return new Intl.DateTimeFormat("es-ES",{dateStyle:"medium"}).format(new Date(value+"T12:00:00")); }
function timeLabel(value: string) { return value.slice(0,5); }
const statusText: Record<LeaveRequest["status"],string> = { pending:"Pendiente", approved:"Aprobada", rejected:"Rechazada", cancelled:"Cancelada" };
const typeText: Record<Shift["shift_type"],string> = { continuous:"Continua", split:"Partida", variable:"Variable por día" };

export default function TeamPlanningPage() {
  const [session,setSession] = useState<Session|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [employees,setEmployees] = useState<Profile[]>([]);
  const [shifts,setShifts] = useState<Shift[]>([]);
  const [requests,setRequests] = useState<LeaveRequest[]>([]);
  const [settings,setSettings] = useState<Settings>(emptySettings);
  const [weekStart,setWeekStart] = useState(()=>mondayOf(new Date()));
  const [tab,setTab] = useState<"schedule"|"leave"|"settings">("schedule");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");
  const [selectedEmployee,setSelectedEmployee] = useState("");
  const [editingShiftId,setEditingShiftId] = useState<string|null>(null);
  const [quickAddCell,setQuickAddCell] = useState<string|null>(null);
  const [quickStart,setQuickStart] = useState("08:00");
  const [quickEnd,setQuickEnd] = useState("16:00");
  const [shiftDate,setShiftDate] = useState(dateKey(new Date()));
  const [shiftStart,setShiftStart] = useState("08:00");
  const [shiftEnd,setShiftEnd] = useState("16:00");
  const [shiftType,setShiftType] = useState<Shift["shift_type"]>("continuous");
  const [shiftOvernight,setShiftOvernight] = useState(false);
  const [shiftNotes,setShiftNotes] = useState("");
  const [leaveStart,setLeaveStart] = useState(dateKey(new Date()));
  const [leaveEnd,setLeaveEnd] = useState(dateKey(new Date()));
  const [leaveType,setLeaveType] = useState<LeaveRequest["leave_type"]>("vacation");
  const [leaveNotes,setLeaveNotes] = useState("");
  const [settingMethod,setSettingMethod] = useState<Settings["counting_method"]>("working_days");
  const [settingEntitlement,setSettingEntitlement] = useState("");
  const [settingMonth,setSettingMonth] = useState("1");
  const [settingCarryover,setSettingCarryover] = useState(false);

  const request = useCallback(async (path:string,method="GET",body?:object,query="") => {
    if(!session?.access_token) throw new Error("Inicia sesión de nuevo para continuar.");
    const response = await fetch(path+query,{method,headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    const result = await response.json();
    if(!response.ok) throw new Error(result.error||"No se pudo completar la operación.");
    return result;
  },[session]);

  const load = useCallback(async () => {
    if(!session || !supabase) return;
    setLoading(true);
    try {
      const {data:rawProfile} = await supabase.from("profiles").select("user_id,full_name,role,active").eq("user_id",session.user.id).maybeSingle();
      if(!rawProfile?.active) { setProfile(rawProfile as Profile|null); setLoading(false); return; }
      setProfile(rawProfile as Profile);
      const from=dateKey(weekStart), to=dateKey(addDays(weekStart,6));
      const [schedule,leave] = await Promise.all([
        request("/api/team/schedules","GET",undefined,"?from="+from+"&to="+to),
        request("/api/team/leave")
      ]);
      setEmployees(schedule.employees||[]);
      setShifts(schedule.shifts||[]);
      setRequests(leave.requests||[]);
      if(leave.settings) {
        const s=leave.settings as Settings;
        setSettings(s); setSettingMethod(s.counting_method); setSettingEntitlement(s.annual_entitlement===null?"":String(s.annual_entitlement));
        setSettingMonth(String(s.leave_year_start_month)); setSettingCarryover(s.allow_carryover);
      }
      if(!selectedEmployee && schedule.employees?.length) setSelectedEmployee(schedule.employees[0].user_id);
    } catch(e) { setNotice(e instanceof Error?e.message:"No se pudo cargar la planificación."); }
    finally { setLoading(false); }
  },[session,weekStart,request,selectedEmployee]);

  useEffect(()=>{
    if(!supabase) { setLoading(false); return; }
    let alive=true;
    supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);if(!data.session)setLoading(false);}});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);if(!next)setLoading(false);});
    return ()=>{alive=false;listener.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{if(session) void load();},[session,load]);

  const days = useMemo(()=>Array.from({length:7},(_,i)=>dateKey(addDays(weekStart,i))),[weekStart]);
  const employeeName = useCallback((id:string)=>employees.find(e=>e.user_id===id)?.full_name||"Empleado", [employees]);
  const isAdmin = profile?.role==="admin";
  const weekHours = useCallback((userId:string)=>{
    const mins=shifts.filter(s=>s.user_id===userId).reduce((sum,s)=>{
      const [sh,sm]=s.starts_at.split(":").map(Number),[eh,em]=s.ends_at.split(":").map(Number);
      let duration=eh*60+em-sh*60-sm;if(s.ends_next_day||duration<0)duration+=1440;
      return sum+duration;
    },0);
    return (mins/60).toLocaleString("es-ES",{maximumFractionDigits:1});
  },[shifts]);

  async function saveShift(event:FormEvent) {
    event.preventDefault();setSaving(true);setNotice("");
    try { await request("/api/team/schedules",editingShiftId?"PATCH":"POST",{...(editingShiftId?{id:editingShiftId}:{}),user_id:selectedEmployee,shift_date:shiftDate,starts_at:shiftStart,ends_at:shiftEnd,ends_next_day:shiftOvernight,shift_type:shiftType,notes:shiftNotes});
      setNotice(editingShiftId?"Turno actualizado.":"Turno guardado.");setEditingShiftId(null);setShiftNotes("");await load();
    } catch(e) {setNotice(e instanceof Error?e.message:"No se pudo guardar el turno.");}
    finally {setSaving(false);}
  }
  async function saveQuickShift(event:FormEvent, employeeId:string, day:string) {
    event.preventDefault();setSaving(true);setNotice("");
    try {
      const existing=editingShiftId?shifts.find(s=>s.id===editingShiftId):null;
      await request("/api/team/schedules",existing?"PATCH":"POST",{...(existing?{id:existing.id}:{}),user_id:employeeId,shift_date:day,starts_at:quickStart,ends_at:quickEnd,ends_next_day:existing?.ends_next_day||false,shift_type:existing?.shift_type||"continuous",notes:existing?.notes||""});
      setNotice(existing?"Turno actualizado.":"Jornada guardada.");setQuickAddCell(null);setEditingShiftId(null);await load();
    } catch(e) {setNotice(e instanceof Error?e.message:"No se pudo guardar la jornada.");}
    finally {setSaving(false);}
  }

  async function deleteShift(id:string) {
    if(!window.confirm("¿Eliminar este turno?"))return;setSaving(true);
    try {await request("/api/team/schedules","DELETE",{id});setNotice("Turno eliminado.");await load();}
    catch(e){setNotice(e instanceof Error?e.message:"No se pudo eliminar el turno.");}finally{setSaving(false);}
  }
  async function submitLeave(event:FormEvent) {
    event.preventDefault();setSaving(true);setNotice("");
    try {await request("/api/team/leave","POST",{starts_on:leaveStart,ends_on:leaveEnd,leave_type:leaveType,notes:leaveNotes});setNotice("Solicitud enviada para revisión.");setLeaveNotes("");await load();}
    catch(e){setNotice(e instanceof Error?e.message:"No se pudo enviar la solicitud.");}finally{setSaving(false);}
  }
  async function reviewLeave(item:LeaveRequest,status:"approved"|"rejected"|"cancelled") {
    setSaving(true);
    try {await request("/api/team/leave","PATCH",{id:item.id,status});setNotice(status==="approved"?"Vacaciones aprobadas.":status==="rejected"?"Solicitud rechazada.":"Solicitud cancelada.");await load();}
    catch(e){setNotice(e instanceof Error?e.message:"No se pudo actualizar la solicitud.");}finally{setSaving(false);}
  }
  async function saveSettings(event:FormEvent) {
    event.preventDefault();setSaving(true);
    try {const result=await request("/api/team/leave-settings","POST",{counting_method:settingMethod,annual_entitlement:settingEntitlement===""?null:Number(settingEntitlement),leave_year_start_month:Number(settingMonth),allow_carryover:settingCarryover});
      setSettings(result.settings);setNotice("Política de vacaciones guardada.");}
    catch(e){setNotice(e instanceof Error?e.message:"No se pudo guardar la política.");}finally{setSaving(false);}
  }

  if(!supabase) return <main className="lp-page"><section className="lp-card lp-login"><h1>La Partida</h1><p>Falta configurar Supabase.</p></section></main>;
  if(loading&&!profile) return <main className="lp-page"><div className="lp-loading">Cargando planificación…</div></main>;
  if(!session) return <main className="lp-page"><section className="lp-card lp-login"><h1>Horarios y vacaciones</h1><p>Inicia sesión para continuar.</p><Link className="lp-button lp-primary" href="/">Volver al inicio</Link></section></main>;
  if(!profile?.active) return <main className="lp-page"><section className="lp-card lp-login"><h1>Cuenta desactivada</h1><p>Contacta con administración.</p></section></main>;

  const pending=requests.filter(r=>r.status==="pending");
  const visibleRequests=requests.filter(r=>isAdmin||r.user_id===profile.user_id||r.status==="approved").sort((a,b)=>a.starts_on.localeCompare(b.starts_on));
  const titleRange=longDate(days[0])+" – "+longDate(days[6]);
  return <main className="lp-page lp-team-page">
    <AppHeader fullName={profile.full_name||session.user.email||"Usuario"} role={profile.role} onLogout={()=>{void supabase.auth.signOut();window.location.href="/";}}/>
    <ModuleNavigation activeModule="equipo"/>
    <div className="lp-content lp-team-content lp-planning-content">
      <header className="lp-heading lp-planning-heading"><div><span className="lp-kicker">ORGANIZACIÓN DE COCINA</span><h1>Horarios y vacaciones</h1><p>Consulta el horario de todo el equipo, solicita días libres y gestiona las aprobaciones.</p></div><Link href="/equipo" className="lp-button lp-secondary">Gestionar equipo</Link></header>
      {notice&&<div className="lp-notice" role="status">{notice}</div>}
      <div className="lp-planning-tabs">
        <button type="button" className={tab==="schedule"?"active":""} onClick={()=>setTab("schedule")}><CalendarDays size={16}/> Horarios del equipo</button>
        <button type="button" className={tab==="leave"?"active":""} onClick={()=>setTab("leave")}><Palmtree size={16}/> Vacaciones y ausencias{isAdmin&&pending.length>0&&<span>{pending.length}</span>}</button>
        {isAdmin&&<button type="button" className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings2 size={16}/> Política de empresa</button>}
      </div>
      {tab==="schedule"&&<>
        <section className="lp-card lp-planning-week">
          <div className="lp-planning-weekbar"><button type="button" className="lp-icon-button" aria-label="Semana anterior" onClick={()=>setWeekStart(addDays(weekStart,-7))}><ChevronLeft size={18}/></button><div><h2>Planificación semanal</h2><p>{titleRange}</p></div><button type="button" className="lp-icon-button" aria-label="Semana siguiente" onClick={()=>setWeekStart(addDays(weekStart,7))}><ChevronRight size={18}/></button><button type="button" className="lp-button lp-secondary" onClick={()=>setWeekStart(mondayOf(new Date()))}>Esta semana</button></div>
          {loading?<p className="lp-muted">Cargando horarios…</p>:<div className="lp-planning-grid-wrap"><table className="lp-planning-grid"><thead><tr><th>Equipo</th>{days.map(d=><th key={d}>{dayLabel(d)}</th>)}<th>Horas</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.user_id}><th><span>{employee.full_name}</span>{isAdmin&&<small>{employee.role==="admin"?"Administración":"Empleado"}</small>}</th>{days.map(day=><td key={day}><div className="lp-planning-cell-shifts">{shifts.filter(s=>s.user_id===employee.user_id&&s.shift_date===day).map(s=><div className="lp-planning-shift" key={s.id}><strong>{timeLabel(s.starts_at)}–{timeLabel(s.ends_at)}{s.ends_next_day?" +1":""}</strong><span>{typeText[s.shift_type]}</span>{s.notes&&<small>{s.notes}</small>}{isAdmin&&<><div className="lp-planning-shift-actions"><button type="button" aria-label="Editar turno" disabled={saving} onClick={()=>{setEditingShiftId(s.id);setQuickAddCell(employee.user_id+":"+day);setQuickStart(timeLabel(s.starts_at));setQuickEnd(timeLabel(s.ends_at));}}><Pencil size={12}/></button><button type="button" aria-label="Eliminar turno" disabled={saving} onClick={()=>void deleteShift(s.id)}><Trash2 size={12}/></button></div></>}</div>)}{isAdmin&&<>{quickAddCell===employee.user_id+":"+day?<form className="lp-planning-quick-form" onSubmit={e=>void saveQuickShift(e,employee.user_id,day)}><label>Inicio<input aria-label="Hora de inicio" type="time" required value={quickStart} onChange={e=>setQuickStart(e.target.value)}/></label><label>Fin<input aria-label="Hora de fin" type="time" required value={quickEnd} onChange={e=>setQuickEnd(e.target.value)}/></label><div className="lp-planning-quick-actions"><button type="submit" disabled={saving} aria-label="Guardar jornada"><Check size={13}/></button><button type="button" disabled={saving} aria-label="Cancelar" onClick={()=>{setQuickAddCell(null);setEditingShiftId(null);}}><X size={13}/></button></div></form>:<button type="button" className="lp-planning-add-shift" aria-label={"Añadir jornada de "+employee.full_name+" el "+dayLabel(day)} title="Añadir jornada (08:00–16:00)" disabled={saving} onClick={()=>{setQuickAddCell(employee.user_id+":"+day);setQuickStart("08:00");setQuickEnd("16:00");}}><Plus size={14}/></button>}</>}</div></td>)}<td className="lp-planning-hours">{weekHours(employee.user_id)} h</td></tr>)}</tbody></table></div>}
          <p className="lp-planning-footnote">Todo el personal activo puede consultar estos horarios. Solo administración puede crearlos o modificarlos. Los turnos partidos se registran como dos tramos independientes en el mismo día.</p>
        </section>
        {isAdmin&&<section className="lp-card lp-planning-form-card"><div className="lp-card-title"><div><span className="lp-kicker">PLANIFICACIÓN MANUAL</span><h2>{editingShiftId?"Editar turno":"Añadir turno"}</h2></div><Plus size={21}/></div><form className="lp-planning-form" onSubmit={saveShift}>
          <label>Empleado<select required value={selectedEmployee} onChange={e=>setSelectedEmployee(e.target.value)}>{employees.map(e=><option key={e.user_id} value={e.user_id}>{e.full_name}</option>)}</select></label>
          <label>Día<input type="date" required value={shiftDate} onChange={e=>setShiftDate(e.target.value)}/></label>
          <label>Tipo de jornada<select value={shiftType} onChange={e=>setShiftType(e.target.value as Shift["shift_type"])}><option value="continuous">Continua</option><option value="split">Partida (añade cada tramo)</option><option value="variable">Variable por día</option></select></label>
          <label>Inicio<input type="time" required value={shiftStart} onChange={e=>setShiftStart(e.target.value)}/></label>
          <label>Fin<input type="time" required value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)}/></label>
          <label className="lp-planning-check"><input type="checkbox" checked={shiftOvernight} onChange={e=>setShiftOvernight(e.target.checked)}/> Termina al día siguiente</label>
          <label className="lp-planning-wide">Notas (opcional)<input maxLength={500} value={shiftNotes} onChange={e=>setShiftNotes(e.target.value)} placeholder="Ej. servicio de evento"/></label>
          <button type="submit" className="lp-button lp-primary" disabled={saving||!selectedEmployee}><Save size={15}/>{saving?"Guardando…":editingShiftId?"Guardar cambios":"Guardar turno"}</button>{editingShiftId&&<button type="button" className="lp-button lp-secondary" onClick={()=>{setEditingShiftId(null);setShiftNotes("");}}>Cancelar edición</button>}
        </form></section>}
      </>}
      {tab==="leave"&&<div className="lp-planning-leave-layout">
        <section className="lp-card lp-planning-form-card"><div className="lp-card-title"><div><span className="lp-kicker">SOLICITUD</span><h2>Solicitar días libres</h2></div><Palmtree size={21}/></div><form className="lp-planning-form" onSubmit={submitLeave}>
          <label>Tipo<select value={leaveType} onChange={e=>setLeaveType(e.target.value as LeaveRequest["leave_type"])}><option value="vacation">Vacaciones</option><option value="personal">Asunto personal</option><option value="other">Otro permiso</option></select></label>
          <label>Desde<input type="date" required value={leaveStart} onChange={e=>{setLeaveStart(e.target.value);if(leaveEnd<e.target.value)setLeaveEnd(e.target.value);}}/></label>
          <label>Hasta<input type="date" min={leaveStart} required value={leaveEnd} onChange={e=>setLeaveEnd(e.target.value)}/></label>
          <label className="lp-planning-wide">Nota para administración (opcional)<textarea maxLength={1000} value={leaveNotes} onChange={e=>setLeaveNotes(e.target.value)} rows={3}/></label>
          <button type="submit" className="lp-button lp-primary" disabled={saving}><Plus size={15}/>{saving?"Enviando…":"Enviar solicitud"}</button>
        </form><p className="lp-planning-footnote">Las solicitudes quedan pendientes hasta que administración las apruebe o rechace. Las ausencias aprobadas se muestran al equipo.</p></section>
        <section className="lp-card lp-planning-requests"><div className="lp-card-title"><div><span className="lp-kicker">CALENDARIO Y SEGUIMIENTO</span><h2>{isAdmin?"Solicitudes del equipo":"Mis solicitudes y ausencias del equipo"}</h2></div></div>
          {visibleRequests.length===0?<p className="lp-muted">Todavía no hay solicitudes que mostrar.</p>:<div className="lp-planning-request-list">{visibleRequests.map(item=><article className="lp-planning-request" key={item.id}><div className="lp-planning-request-top"><div><strong>{isAdmin?employeeName(item.user_id):item.user_id===profile.user_id?"Mi solicitud":employeeName(item.user_id)}</strong><span>{longDate(item.starts_on)} – {longDate(item.ends_on)}</span></div><span className={"lp-planning-status "+item.status}>{statusText[item.status]}</span></div><p>{item.leave_type==="vacation"?"Vacaciones":item.leave_type==="personal"?"Asunto personal":"Otro permiso"}{item.notes?" · "+item.notes:""}</p>{item.review_note&&<small>{item.review_note}</small>}<div className="lp-planning-request-actions">{isAdmin&&item.status==="pending"&&<><button type="button" className="lp-button lp-primary" disabled={saving} onClick={()=>void reviewLeave(item,"approved")}><Check size={14}/> Aprobar</button><button type="button" className="lp-button lp-secondary" disabled={saving} onClick={()=>void reviewLeave(item,"rejected")}><X size={14}/> Rechazar</button></>}{item.user_id===profile.user_id&&item.status==="pending"&&<button type="button" className="lp-button lp-secondary" disabled={saving} onClick={()=>void reviewLeave(item,"cancelled")}>Cancelar solicitud</button>}</div></article>)}</div>}
        </section>
      </div>}
      {tab==="settings"&&isAdmin&&<section className="lp-card lp-planning-form-card"><div className="lp-card-title"><div><span className="lp-kicker">CONFIGURACIÓN DE EMPRESA</span><h2>Cómputo de vacaciones</h2></div><Settings2 size={21}/></div><p className="lp-planning-footnote">No se presupone ningún saldo anual: déjalo vacío hasta confirmar el convenio o la política aplicable.</p><form className="lp-planning-form" onSubmit={saveSettings}>
        <label>Cómo se cuentan los días<select value={settingMethod} onChange={e=>setSettingMethod(e.target.value as Settings["counting_method"])}><option value="working_days">Días laborables</option><option value="calendar_days">Días naturales</option></select></label>
        <label>Días por año (opcional)<input type="number" min="0" max="366" step="0.5" value={settingEntitlement} onChange={e=>setSettingEntitlement(e.target.value)} placeholder="Sin configurar"/></label>
        <label>Mes de inicio del año<select value={settingMonth} onChange={e=>setSettingMonth(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Intl.DateTimeFormat("es-ES",{month:"long"}).format(new Date(2026,i,1))}</option>)}</select></label>
        <label className="lp-planning-check"><input type="checkbox" checked={settingCarryover} onChange={e=>setSettingCarryover(e.target.checked)}/> Permitir arrastrar días</label>
        <button type="submit" className="lp-button lp-primary" disabled={saving}><Save size={15}/>{saving?"Guardando…":"Guardar política"}</button>
      </form><div className="lp-planning-policy-summary"><strong>Configuración actual</strong><span>{settings.counting_method==="working_days"?"Cómputo en días laborables":"Cómputo en días naturales"}</span><span>{settings.annual_entitlement===null?"Saldo anual no configurado":settings.annual_entitlement+" días por año"}</span><span>Año desde {new Intl.DateTimeFormat("es-ES",{month:"long"}).format(new Date(2026,settings.leave_year_start_month-1,1))}</span><span>{settings.allow_carryover?"Se permite arrastrar saldo":"No se permite arrastrar saldo"}</span></div></section>}
      <p className="lp-planning-footnote">La aplicación registra solicitudes y decisiones, pero no sustituye la revisión de cobertura ni determina derechos laborales. El saldo consumido automático y las reglas por convenio quedan pendientes de definir.</p>
    </div>
  </main>;
}
