"use client";

import { useMemo, useState } from "react";
import { ChefHat, LayoutDashboard, CalendarDays, Clock3, Users, Download, CircleHelp, Bell, ChevronLeft, ChevronRight, Search, MoreHorizontal, Play, Pause, Square, Plus, ArrowUpRight, CircleAlert, CheckCircle2 } from "lucide-react";

type Employee = { id: number; name: string; role: string; initials: string; color: string; planned: string; actual: string; status: "working" | "break" | "off"; start: string; end: string; pause: string; };
const initialEmployees: Employee[] = [
  { id: 1, name: "María García", role: "Cocinera", initials: "MG", color: "peach", planned: "08:00–16:00", actual: "08:02–", status: "working", start: "08:02", end: "—", pause: "0 min" },
  { id: 2, name: "Carlos Ruiz", role: "Ayudante de cocina", initials: "CR", color: "blue", planned: "08:00–16:00", actual: "07:56–", status: "break", start: "07:56", end: "—", pause: "18 min" },
  { id: 3, name: "Lucía Martín", role: "Cocinera", initials: "LM", color: "lilac", planned: "09:00–17:00", actual: "09:04–", status: "working", start: "09:04", end: "—", pause: "0 min" },
  { id: 4, name: "Javier López", role: "Preparación", initials: "JL", color: "mint", planned: "10:00–18:00", actual: "—", status: "off", start: "—", end: "—", pause: "—" },
  { id: 5, name: "Ana Torres", role: "Cocinera", initials: "AT", color: "yellow", planned: "12:00–20:00", actual: "—", status: "off", start: "—", end: "—", pause: "—" },
];
const week = [
  { day: "LUN", date: "12", total: "31 h 48 min", shifts: 5 },
  { day: "MAR", date: "13", total: "24 h 12 min", shifts: 5 },
  { day: "MIÉ", date: "14", total: "—", shifts: 4 },
  { day: "JUE", date: "15", total: "—", shifts: 5 },
  { day: "VIE", date: "16", total: "—", shifts: 5 },
  { day: "SÁB", date: "17", total: "—", shifts: 3 },
  { day: "DOM", date: "18", total: "—", shifts: 0 },
];

export default function Home() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [tab, setTab] = useState("Resumen");
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState("13");
  const [notice, setNotice] = useState("Vista de demostración: los fichajes no se guardan todavía.");
  const filtered = useMemo(() => employees.filter(e => e.name.toLowerCase().includes(query.toLowerCase())), [employees, query]);
  const updateStatus = (id: number, status: Employee["status"]) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status, start: status === "working" && e.start === "—" ? new Date().toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"}) : e.start } : e));
    setNotice("Demostración actualizada. Estos cambios solo viven en esta sesión.");
  };
  const exportCsv = () => {
    const rows = [["Empleado","Puesto","Turno previsto","Estado","Entrada","Salida","Pausa"], ...employees.map(e => [e.name,e.role,e.planned,e.status,e.start,e.end,e.pause])];
    const csv = rows.map(r => r.map(v => '"' + v.replaceAll('"','""') + '"').join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8;"}));
    const a = document.createElement("a"); a.href = url; a.download = "la-partida-demo.csv"; a.click(); URL.revokeObjectURL(url);
    setNotice("CSV de demostración descargado.");
  };
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ChefHat size={23}/></div><div><strong>La Partida</strong><span>GESTIÓN DE COCINA</span></div></div>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="workspace"><div className="workspace-avatar">LP</div><div><strong>Equipo de cocina</strong><span>Planificación y horarios</span></div><MoreHorizontal size={18}/></div>
        <div className="nav-label">MENÚ PRINCIPAL</div>
        <nav>
          {[["Resumen",LayoutDashboard],["Calendario",CalendarDays],["Fichajes",Clock3],["Equipo",Users]].map(([label, Icon]: any) => <button key={label} className={tab === label ? "nav-item active" : "nav-item"} onClick={() => setTab(label)}><Icon size={18}/><span>{label}</span>{label === "Fichajes" && <i className="nav-dot"/>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><strong>¿Necesitas ayuda?</strong><p>Organiza el día sin perder detalle.</p><button onClick={() => setNotice("Ayuda: esta es una demo con datos ficticios.")}>Ver guía rápida <ArrowUpRight size={14}/></button></div><div className="profile"><div className="avatar profile-avatar">P</div><div><strong>Pau · Administradora</strong><span>Vista de demostración</span></div><MoreHorizontal size={18}/></div></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Equipo de cocina <span>/</span> <strong>{tab}</strong></div><div className="top-actions"><span className="today-chip"><span className="green-dot"/> Martes, 13 oct 2026</span><button className="icon-button" aria-label="Notificaciones" onClick={() => setNotice("No hay notificaciones nuevas en esta demo.")}><Bell size={18}/></button><div className="avatar top-avatar">P</div></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">MARTES · 13 OCTUBRE 2026</div><h1>{tab === "Resumen" ? "Buenos días, Pau" : tab}</h1><p>{tab === "Resumen" ? "Aquí tienes el pulso de tu equipo para hoy." : "Vista previa de planificación y registro horario."}</p></div><button className="button primary" onClick={() => setNotice("La creación de turnos estará disponible en la siguiente fase.")}><Plus size={17}/> Nuevo turno</button></div>
          <div className="notice"><CircleAlert size={16}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Horas registradas hoy</span><span className="stat-icon green"><Clock3 size={18}/></span></div><div className="stat-value">15 h 02 min</div><div className="stat-foot"><span className="trend">+2,4%</span> frente a ayer <span className="tiny-dot"/></div><div className="progress"><span style={{width:"64%"}}/></div><div className="progress-caption"><span>15 h 02 min registradas</span><span>24 h previstas</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Personas trabajando</span><span className="stat-icon blue"><Users size={18}/></span></div><div className="stat-value">{employees.filter(e => e.status === "working" || e.status === "break").length}<small> / 5</small></div><div className="stat-foot">Ahora mismo <span className="live-dot"/> <strong>En directo (demo)</strong></div><div className="people-stack"><span className="avatar peach">M</span><span className="avatar blue">C</span><span className="avatar lilac">L</span><span className="stack-more">+2</span><span className="stack-label">en el equipo</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Turnos por revisar</span><span className="stat-icon amber"><CircleAlert size={18}/></span></div><div className="stat-value">2</div><div className="stat-foot"><span className="amber-text">1 fichaje abierto</span> · 1 pausa activa</div><div className="review-link" onClick={() => setTab("Fichajes")}>Revisar fichajes <ArrowUpRight size={15}/></div></div>
          </div>
          <div className="section-head"><div><h2>Control de hoy</h2><p>Comprueba el estado del equipo de un vistazo.</p></div><div className="table-actions"><label className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empleado..."/></label><button className="button secondary" onClick={exportCsv}><Download size={16}/> Exportar CSV</button></div></div>
          <div className="table-card"><div className="table-scroll"><table><thead><tr><th>EMPLEADO</th><th>TURNO PREVISTO</th><th>FICHAJE REAL</th><th>PAUSA</th><th>ESTADO</th><th>ACCIONES (DEMO)</th></tr></thead><tbody>{filtered.map(e => <tr key={e.id}><td><div className="employee-cell"><div className={"avatar " + e.color}>{e.initials}</div><div><strong>{e.name}</strong><span>{e.role}</span></div></div></td><td><span className="shift-time">{e.planned}</span></td><td><span className="actual-time">{e.actual}</span></td><td>{e.pause}</td><td><span className={"status-pill " + e.status}><span/>{e.status === "working" ? "Trabajando" : e.status === "break" ? "En pausa" : "Sin fichar"}</span></td><td><div className="row-actions">{e.status === "off" ? <button className="action-button start" title="Simular entrada" onClick={() => updateStatus(e.id,"working")}><Play size={14}/> Entrar</button> : e.status === "working" ? <><button className="action-button" title="Simular pausa" onClick={() => updateStatus(e.id,"break")}><Pause size={14}/></button><button className="action-button stop" title="Simular salida" onClick={() => updateStatus(e.id,"off")}><Square size={13}/></button></> : <><button className="action-button start" title="Reanudar" onClick={() => updateStatus(e.id,"working")}><Play size={14}/></button><button className="action-button stop" title="Finalizar jornada" onClick={() => updateStatus(e.id,"off")}><Square size={13}/></button></>}</div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state">No hay empleados con ese nombre.</div>}</div><div className="table-footer"><span>Mostrando {filtered.length} de {employees.length} empleados de ejemplo</span><button onClick={() => setTab("Equipo")}>Ver equipo completo <ArrowUpRight size={14}/></button></div></div>
          <div className="bottom-grid"><div className="panel calendar-panel"><div className="panel-heading"><div><h2>Esta semana</h2><p>12 – 18 octubre 2026</p></div><div className="calendar-controls"><button aria-label="Semana anterior" onClick={() => setNotice("La navegación de semanas se habilitará con el calendario real.")}><ChevronLeft size={16}/></button><button aria-label="Semana siguiente" onClick={() => setNotice("La navegación de semanas se habilitará con el calendario real.")}><ChevronRight size={16}/></button></div></div><div className="week-grid">{week.map(d => <button key={d.date} className={"day-card " + (selectedDay === d.date ? "selected" : "")} onClick={() => setSelectedDay(d.date)}><span>{d.day}</span><strong>{d.date}</strong><i className={d.shifts ? "day-indicator" : "day-indicator empty"}/><small>{d.total}</small></button>)}</div><div className="calendar-foot"><span><i className="legend-dot"/> Turnos previstos</span><span><i className="legend-dot actual-legend"/> Horas fichadas (demo)</span></div></div>
            <div className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimos movimientos (ejemplo)</p></div><button className="text-link" onClick={() => setTab("Fichajes")}>Ver todos</button></div><div className="activity-list"><div className="activity-row"><div className="activity-icon green"><Play size={15}/></div><div><strong>María García ha fichado</strong><span>Entrada · Hoy, 08:02</span></div><time>08:02</time></div><div className="activity-row"><div className="activity-icon amber"><Pause size={15}/></div><div><strong>Carlos Ruiz está en pausa</strong><span>Pausa iniciada · Hoy, 11:40</span></div><time>11:40</time></div><div className="activity-row"><div className="activity-icon blue"><CheckCircle2 size={15}/></div><div><strong>Turno de Lucía iniciado</strong><span>Entrada · Hoy, 09:04</span></div><time>09:04</time></div></div></div></div>
          <footer>La Partida <span>·</span> MVP de demostración <span>·</span> Datos ficticios, no usar para registro laboral real.</footer>
        </div>
      </section>
    </main>
  );
}