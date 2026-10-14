"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import { CalendarDays, ClipboardList, Plus, RefreshCw, Save, ChefHat, Clock3, Users, ArrowRight, Printer, X, CheckCircle2 } from "lucide-react";
import ModuleNavigation from "@/components/module-navigation";
import AppHeader from "@/components/app-header";

type Profile = { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean };
type Ingredient = { name: string; quantity: string; note?: string; recipe_id?: string | null };
type RecipeStep = { instruction: string; minutes?: string; temperature?: string };
type Recipe = {
  id: string; title: string; recipe_type: "final" | "intermediate"; servings: number;
  yield_quantity: number | null; yield_unit: string; ingredients: Ingredient[]; steps: RecipeStep[];
  category?: string; status: string; prep_minutes?: number | null; cook_minutes?: number | null;
  allergens?: string[]; dietary_tags?: string[]; storage_notes?: string; description?: string;
};
type MenuItem = { id: string; recipe_id: string; course: string; sort_order: number };
type MenuRecord = { id: string; title: string; description: string; status: string; menu_items: MenuItem[] };
type ProductionEvent = {
  id: string; title: string; event_date: string; service_time: string | null; guest_count: number;
  menu_id: string | null; menu_title_snapshot: string; status: "draft" | "planned" | "in_progress" | "completed" | "cancelled";
  notes: string; created_by: string; created_at: string;
};
type ProductionTask = {
  id: string; event_id: string; recipe_id: string | null; recipe_title: string; recipe_type: "final" | "intermediate";
  production_date: string; quantity_factor: number; quantity_label: string; recipe_snapshot: Recipe;
  status: "pending" | "in_progress" | "completed"; notes: string; sort_order: number;
};
type PlannedTask = Omit<ProductionTask, "id" | "event_id" | "status" | "notes" | "created_at" | "updated_at">;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const statusLabels: Record<ProductionEvent["status"], string> = {
  draft: "Borrador", planned: "Planificado", in_progress: "En producción", completed: "Completado", cancelled: "Cancelado"
};
const taskStatusLabels: Record<ProductionTask["status"], string> = {
  pending: "Pendiente", in_progress: "En curso", completed: "Terminado"
};
function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateLabel(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeZone: "Europe/Madrid" }).format(new Date(`${value}T12:00:00`));
}
function formatFactor(value: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(value);
}
function normalizeUnit(unit: string) {
  const value = unit.trim().toLocaleLowerCase("es").replace(/\./g, "");
  const aliases: Record<string, string> = {
    gr: "g", gramo: "g", gramos: "g", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
    miligramo: "mg", miligramos: "mg", mililitro: "ml", mililitros: "ml", litro: "l", litros: "l",
    centilitro: "cl", centilitros: "cl", unidad: "ud", unidades: "ud", uds: "ud", u: "ud",
    pieza: "ud", piezas: "ud", raciones: "racion", pax: "pax"
  };
  return aliases[value] || value;
}
function parseQuantityUnit(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? { amount, unit: normalizeUnit(match[2]) } : null;
}
function convertAmount(amount: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeUnit(fromUnit), to = normalizeUnit(toUnit);
  const factors: Record<string, { group: string; factor: number }> = {
    mg: { group: "mass", factor: .001 }, g: { group: "mass", factor: 1 }, kg: { group: "mass", factor: 1000 },
    ml: { group: "volume", factor: 1 }, cl: { group: "volume", factor: 10 }, dl: { group: "volume", factor: 100 }, l: { group: "volume", factor: 1000 },
    ud: { group: "count", factor: 1 }, racion: { group: "portion", factor: 1 }, pax: { group: "portion", factor: 1 }
  };
  if (from === to) return amount;
  const a = factors[from], b = factors[to];
  return a && b && a.group === b.group ? amount * a.factor / b.factor : null;
}
function intermediateFactor(parent: Recipe, linked: Recipe, parentFactor: number) {
  if (!linked.yield_quantity || linked.yield_quantity <= 0 || !linked.yield_unit) return parentFactor;
  const requirements = (parent.ingredients || []).filter(item => item.recipe_id === linked.id);
  const amounts = requirements.map(item => {
    const parsed = parseQuantityUnit(item.quantity || "");
    return parsed ? convertAmount(parsed.amount * parentFactor, parsed.unit, linked.yield_unit) : null;
  });
  if (!amounts.length || amounts.some(amount => amount === null)) return parentFactor;
  return (amounts as number[]).reduce((sum, amount) => sum + amount, 0) / linked.yield_quantity;
}
function quantityLabel(recipe: Recipe, factor: number, guests: number) {
  if (recipe.recipe_type === "final") return `${guests} pax`;
  if (recipe.yield_quantity && recipe.yield_unit) return `${formatFactor(recipe.yield_quantity * factor)} ${recipe.yield_unit}`;
  return `× ${formatFactor(factor)} de la receta base`;
}
function makePlan(menu: MenuRecord, recipes: Recipe[], guests: number, eventDate: string): PlannedTask[] {
  const finalRecipes = (menu.menu_items || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(item => recipes.find(recipe => recipe.id === item.recipe_id))
    .filter((recipe): recipe is Recipe => Boolean(recipe && recipe.recipe_type === "final"));
  const accumulated = new Map<string, { recipe: Recipe; factor: number; order: number }>();
  let order = 0;
  const add = (recipe: Recipe, factor: number, path: Set<string>) => {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const current = accumulated.get(recipe.id);
    if (current) current.factor += factor;
    else accumulated.set(recipe.id, { recipe, factor, order: order++ });
    if (recipe.recipe_type !== "intermediate" || path.has(recipe.id)) return;
    const nextPath = new Set(path);
    nextPath.add(recipe.id);
    for (const ingredient of recipe.ingredients || []) {
      if (!ingredient.recipe_id) continue;
      const linked = recipes.find(item => item.id === ingredient.recipe_id && item.recipe_type === "intermediate");
      if (linked) add(linked, intermediateFactor(recipe, linked, factor), nextPath);
    }
  };
  for (const recipe of finalRecipes) {
    const factor = guests / Math.max(1, recipe.servings || 1);
    add(recipe, factor, new Set());
  }
  return Array.from(accumulated.values()).map(({ recipe, factor, order: sortOrder }) => ({
    recipe_id: recipe.id,
    recipe_title: recipe.title,
    recipe_type: recipe.recipe_type,
    production_date: shiftDate(eventDate, recipe.recipe_type === "intermediate" ? -2 : -1),
    quantity_factor: factor,
    quantity_label: quantityLabel(recipe, factor, guests),
    recipe_snapshot: JSON.parse(JSON.stringify(recipe)) as Recipe,
    sort_order: sortOrder
  })).sort((a, b) => a.production_date.localeCompare(b.production_date) || a.sort_order - b.sort_order);
}

export default function ProductionPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeView, setActiveView] = useState<"events" | "daily">("events");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState(todayKey);
  const [formOpen, setFormOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", event_date: todayKey(), service_time: "", guest_count: "50", menu_id: "", notes: "" });

  const isAdmin = profile?.role === "admin" && profile.active;
  const selectedEvent = events.find(event => event.id === selectedEventId) || null;
  const selectedMenu = menus.find(menu => menu.id === selectedEvent?.menu_id) || null;

  const refresh = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    const [{ data: profileRow, error: profileError }, { data: menuRows, error: menuError }, { data: recipeRows, error: recipeError }, { data: eventRows, error: eventError }, { data: taskRows, error: taskError }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,role,active").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("menus").select("id,title,description,status,menu_items(id,recipe_id,course,sort_order)").order("created_at", { ascending: false }),
      supabase.from("recipes").select("id,title,recipe_type,servings,yield_quantity,yield_unit,ingredients,steps,category,status,prep_minutes,cook_minutes,allergens,dietary_tags,storage_notes,description").neq("status", "archived").order("title"),
      supabase.from("production_events").select("*").order("event_date", { ascending: true }),
      supabase.from("production_tasks").select("*").order("production_date", { ascending: true }).order("sort_order", { ascending: true })
    ]);
    if (profileError || !profileRow) setNotice("No se pudo cargar tu perfil. Comprueba tu cuenta en La Partida.");
    else setProfile(profileRow as Profile);
    if (menuError) setNotice("No se pudieron cargar los menús: " + menuError.message);
    else setMenus((menuRows || []) as unknown as MenuRecord[]);
    if (recipeError) setNotice("No se pudieron cargar las recetas: " + recipeError.message);
    else setRecipes((recipeRows || []) as unknown as Recipe[]);
    if (eventError) setNotice("No se pudieron cargar los eventos. Comprueba que la migración de producción esté aplicada.");
    else setEvents((eventRows || []) as ProductionEvent[]);
    if (taskError) setNotice("No se pudieron cargar las tareas. Comprueba que la migración de producción esté aplicada.");
    else setTasks((taskRows || []) as unknown as ProductionTask[]);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) { setSession(data.session); if (!data.session) setLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (session) void refresh(); else { setEvents([]); setTasks([]); setMenus([]); setRecipes([]); } }, [session, refresh]);

  const visibleMenus = useMemo(() => menus.filter(menu =>
    isAdmin || menu.status === "published"
  ), [menus, isAdmin]);
  const dailyTasks = useMemo(() => tasks.filter(task => task.production_date === dailyDate)
    .sort((a, b) => a.sort_order - b.sort_order || a.recipe_title.localeCompare(b.recipe_title, "es")), [tasks, dailyDate]);
  const selectedTasks = useMemo(() => tasks.filter(task => task.event_id === selectedEventId)
    .sort((a, b) => a.production_date.localeCompare(b.production_date) || a.sort_order - b.sort_order), [tasks, selectedEventId]);

  const createEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !session || !isAdmin) return;
    if (!eventForm.menu_id) { setNotice("Selecciona un menú para crear el plan."); return; }
    const menu = menus.find(item => item.id === eventForm.menu_id);
    if (!menu) { setNotice("El menú seleccionado ya no está disponible."); return; }
    if (!(menu.menu_items || []).length) { setNotice("El menú no contiene platos. Añade recetas en Menús antes de planificar el evento."); return; }
    setSaving(true); setNotice("");
    const { data, error } = await supabase.from("production_events").insert({
      title: eventForm.title.trim(), event_date: eventForm.event_date, service_time: eventForm.service_time || null,
      guest_count: Number(eventForm.guest_count), menu_id: menu.id, menu_title_snapshot: menu.title,
      status: "draft", notes: eventForm.notes.trim(), created_by: session.user.id
    }).select("*").single();
    setSaving(false);
    if (error || !data) { setNotice("No se pudo crear el evento: " + (error?.message || "Error desconocido")); return; }
    setEvents(current => [...current, data as ProductionEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
    setSelectedEventId(data.id); setFormOpen(false); setActiveView("events");
    setEventForm({ title: "", event_date: todayKey(), service_time: "", guest_count: "50", menu_id: "", notes: "" });
    setNotice("Evento creado. Genera el plan para crear las tareas de producción.");
  };

  const generatePlan = async (event: ProductionEvent) => {
    if (!supabase || !isAdmin) return;
    const menu = menus.find(item => item.id === event.menu_id);
    if (!menu) { setNotice("El menú asociado no está disponible. Edita o vuelve a crear el evento con un menú válido."); return; }
    const existing = tasks.filter(task => task.event_id === event.id);
    if (existing.length && !window.confirm("Se sustituirán las tareas actuales de este evento. ¿Quieres continuar?")) return;
    const plan = makePlan(menu, recipes, event.guest_count, event.event_date);
    if (!plan.length) { setNotice("No se han encontrado platos finales con recetas válidas en este menú."); return; }
    setSaving(true); setNotice("");
    if (existing.length) {
      const { error: deleteError } = await supabase.from("production_tasks").delete().eq("event_id", event.id);
      if (deleteError) { setSaving(false); setNotice("No se pudieron sustituir las tareas: " + deleteError.message); return; }
    }
    const rows = plan.map(task => ({ ...task, event_id: event.id, status: "pending", notes: "" }));
    const { error: insertError } = await supabase.from("production_tasks").insert(rows);
    if (insertError) { setSaving(false); setNotice("No se pudieron crear las tareas: " + insertError.message); await refresh(); return; }
    await supabase.from("production_events").update({ status: "planned" }).eq("id", event.id);
    setSaving(false); setNotice("Plan generado. Las elaboraciones intermedias se programan inicialmente dos días antes y los platos finales un día antes; puedes ajustar cada fecha.");
    await refresh();
  };

  const updateTask = async (task: ProductionTask, patch: Partial<Pick<ProductionTask, "production_date" | "status" | "notes">>) => {
    if (!supabase || !isAdmin) return;
    setTasks(current => current.map(item => item.id === task.id ? { ...item, ...patch } : item));
    const { error } = await supabase.from("production_tasks").update(patch).eq("id", task.id);
    if (error) { setNotice("No se pudo actualizar la tarea: " + error.message); await refresh(); }
  };
  const updateEventStatus = async (event: ProductionEvent, status: ProductionEvent["status"]) => {
    if (!supabase || !isAdmin) return;
    setEvents(current => current.map(item => item.id === event.id ? { ...item, status } : item));
    const { error } = await supabase.from("production_events").update({ status }).eq("id", event.id);
    if (error) { setNotice("No se pudo actualizar el estado del evento: " + error.message); await refresh(); }
  };
  const deleteEvent = async (event: ProductionEvent) => {
    if (!supabase || !isAdmin || !window.confirm(`¿Eliminar el evento “${event.title}” y todas sus tareas?`)) return;
    const { error } = await supabase.from("production_events").delete().eq("id", event.id);
    if (error) { setNotice("No se pudo eliminar el evento: " + error.message); return; }
    setEvents(current => current.filter(item => item.id !== event.id));
    setTasks(current => current.filter(task => task.event_id !== event.id));
    if (selectedEventId === event.id) setSelectedEventId(null);
    setNotice("Evento y tareas eliminados.");
  };

  const previousDay = () => setDailyDate(value => shiftDate(value, -1));
  const nextDay = () => setDailyDate(value => shiftDate(value, 1));

  if (!session && !loading) return <main className="lp-center"><section className="lp-card lp-config"><ChefHat size={28}/><h1>La Partida</h1><p>Inicia sesión desde la página principal para acceder a producción y eventos.</p><a className="lp-button lp-primary" href="/">Ir a iniciar sesión</a></section></main>;
  if (session && profile && !profile.active) return <main className="lp-center"><section className="lp-card lp-config"><ChefHat size={28}/><h1>Cuenta desactivada</h1><p>Contacta con la administradora de La Partida.</p></section></main>;

  return (
    <main className="app-shell lp-production-screen">
      <ModuleNavigation activeModule="eventos" />
      <div className="app-main">
        <AppHeader fullName={profile?.full_name || session?.user.email || "Usuario"} role={profile?.role || "employee"} onLogout={() => { void supabase?.auth.signOut(); window.location.href = "/"; }} />
        <div className="lp-production-content">
          <header className="lp-production-heading">
            <div><div className="lp-kicker">OPERATIVA DE COCINA</div><h1>Producción y eventos</h1><p>Planifica los eventos y reparte las elaboraciones entre los días previos al servicio.</p></div>
            {isAdmin && <button className="lp-button lp-primary" onClick={() => { setFormOpen(value => !value); setNotice(""); }}><Plus size={16}/>{formOpen ? "Cerrar formulario" : "Nuevo evento"}</button>}
          </header>
          {notice && <p className="lp-notice" role="status">{notice}</p>}
          {!isAdmin && profile && <p className="lp-muted">Vista de consulta. Solo los responsables de cocina pueden crear eventos, generar planes o modificar tareas.</p>}
          {formOpen && isAdmin && <section className="lp-card lp-production-form-card">
            <div className="lp-card-title"><div><div className="lp-kicker">PLANIFICACIÓN</div><h2>Crear evento</h2></div><button type="button" className="lp-icon-button" onClick={() => setFormOpen(false)} aria-label="Cerrar formulario"><X size={18}/></button></div>
            <form className="lp-form lp-production-form" onSubmit={createEvent}>
              <label>Nombre del evento<input required minLength={2} maxLength={180} value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Ej. Cena de empresa · Sala principal"/></label>
              <label>Fecha del servicio<input type="date" required value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })}/></label>
              <label>Hora del servicio<input type="time" value={eventForm.service_time} onChange={e => setEventForm({ ...eventForm, service_time: e.target.value })}/></label>
              <label>Comensales<input type="number" min="1" max="100000" required value={eventForm.guest_count} onChange={e => setEventForm({ ...eventForm, guest_count: e.target.value })}/></label>
              <label className="lp-production-form-wide">Menú<select required value={eventForm.menu_id} onChange={e => setEventForm({ ...eventForm, menu_id: e.target.value })}><option value="">Seleccionar menú…</option>{visibleMenus.map(menu => <option key={menu.id} value={menu.id}>{menu.title}{menu.status !== "published" ? " · Borrador" : ""}</option>)}</select></label>
              <label className="lp-production-form-wide">Observaciones<textarea rows={3} value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Accesos, restricciones, horario de montaje…"/></label>
              <div className="lp-production-form-wide lp-recipe-form-actions"><button type="submit" className="lp-button lp-primary" disabled={saving || !isAdmin}><Save size={16}/>{saving ? "Guardando…" : "Crear evento"}</button></div>
            </form>
          </section>}

          <div className="lp-production-tabs" role="tablist" aria-label="Vista de producción">
            <button type="button" role="tab" aria-selected={activeView === "events"} className={activeView === "events" ? "active" : ""} onClick={() => setActiveView("events")}><CalendarDays size={16}/> Por evento <span>{events.length}</span></button>
            <button type="button" role="tab" aria-selected={activeView === "daily"} className={activeView === "daily" ? "active" : ""} onClick={() => setActiveView("daily")}><ClipboardList size={16}/> Por día</button>
          </div>

          {loading ? <section className="lp-card lp-week-empty">Cargando producción…</section> : activeView === "events" ? <div className="lp-production-layout">
            <section className="lp-card lp-production-event-list">
              <div className="lp-card-title"><div><div className="lp-kicker">AGENDA</div><h2>Eventos</h2></div><span className="lp-production-count">{events.length}</span></div>
              {!events.length ? <div className="lp-week-empty"><CalendarDays size={26}/><strong>Aún no hay eventos</strong><span>{isAdmin ? "Crea un evento y selecciona uno de los menús existentes." : "Los eventos aparecerán aquí cuando estén planificados."}</span></div> :
                <div className="lp-production-event-items">{events.map(event => <button type="button" key={event.id} className={selectedEventId === event.id ? "lp-production-event-item active" : "lp-production-event-item"} onClick={() => setSelectedEventId(event.id)}>
                  <span className="lp-production-event-date">{event.event_date}</span><strong>{event.title}</strong><span>{event.menu_title_snapshot || "Menú no disponible"} · {event.guest_count} pax</span><span className={`lp-recipe-status ${event.status === "completed" ? "published" : event.status === "cancelled" ? "archived" : "draft"}`}>{statusLabels[event.status]}</span>
                </button>)}</div>}
            </section>
            <section className="lp-card lp-production-event-detail">
              {!selectedEvent ? <div className="lp-week-empty"><ClipboardList size={28}/><strong>Selecciona un evento</strong><span>Verás el plan de producción, las fechas y el progreso de sus elaboraciones.</span></div> : <>
                <div className="lp-card-title"><div><div className="lp-kicker">FICHA DE EVENTO</div><h2>{selectedEvent.title}</h2><p>{dateLabel(selectedEvent.event_date)}{selectedEvent.service_time ? ` · Servicio ${selectedEvent.service_time.slice(0, 5)}` : ""} · {selectedEvent.guest_count} comensales</p></div></div>
                <div className="lp-production-event-summary"><span><strong>Menú:</strong> {selectedEvent.menu_title_snapshot || "No disponible"}</span>{selectedEvent.notes && <p>{selectedEvent.notes}</p>}</div>
                <div className="lp-production-event-actions">
                  {isAdmin && <><label>Estado del evento<select value={selectedEvent.status} onChange={e => void updateEventStatus(selectedEvent, e.target.value as ProductionEvent["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="lp-button lp-secondary" disabled={saving} onClick={() => void generatePlan(selectedEvent)}><RefreshCw size={15}/>{selectedTasks.length ? "Regenerar plan" : "Generar plan de producción"}</button><button type="button" className="lp-button lp-danger" onClick={() => void deleteEvent(selectedEvent)}>Eliminar evento</button></>}
                  <button type="button" className="lp-button lp-secondary" onClick={() => window.print()}><Printer size={15}/> Imprimir plan</button>
                </div>
                {!selectedTasks.length ? <div className="lp-week-empty"><ClipboardList size={25}/><strong>El plan todavía no está generado</strong><span>{isAdmin ? "Genera el plan para calcular las recetas y las elaboraciones intermedias del menú." : "El responsable de cocina aún no ha generado las tareas."}</span></div> :
                  <div className="lp-production-task-list">{selectedTasks.map(task => <article key={task.id} className="lp-production-task">
                    <div className="lp-production-task-main"><div className="lp-production-task-title"><span className={task.recipe_type === "intermediate" ? "lp-production-kind intermediate" : "lp-production-kind"}>{task.recipe_type === "intermediate" ? "Elaboración intermedia" : "Plato final"}</span><h3>{task.recipe_title}</h3><p className="lp-production-quantity">{task.quantity_label}</p></div><span className={`lp-production-task-status ${task.status}`}>{taskStatusLabels[task.status]}</span></div>
                    <div className="lp-production-task-controls"><label>Fecha de preparación<input type="date" value={task.production_date} disabled={!isAdmin} onChange={e => void updateTask(task, { production_date: e.target.value })}/></label><label>Estado<select value={task.status} disabled={!isAdmin} onChange={e => void updateTask(task, { status: e.target.value as ProductionTask["status"] })}>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="lp-production-task-notes">Notas<input value={task.notes || ""} disabled={!isAdmin} onChange={e => setTasks(current => current.map(item => item.id === task.id ? { ...item, notes: e.target.value } : item))} onBlur={e => void updateTask(task, { notes: e.target.value })} placeholder="Indicaciones para la preparación…"/></label></div>
                    <details className="lp-production-recipe-snapshot"><summary>Ver ingredientes y pasos guardados</summary><p><strong>Ingredientes</strong></p><ul>{(task.recipe_snapshot?.ingredients || []).map((ingredient, index) => <li key={index}>{ingredient.quantity || "A gusto"} · {ingredient.name}{ingredient.note ? ` — ${ingredient.note}` : ""}</li>)}</ul><p><strong>Elaboración</strong></p><ol>{(task.recipe_snapshot?.steps || []).map((step, index) => <li key={index}>{step.instruction}</li>)}</ol></details>
                  </article>)}</div>}
              </>}
            </section>
          </div> : <section className="lp-card lp-production-daily">
            <div className="lp-card-title"><div><div className="lp-kicker">PLAN DIARIO</div><h2>Tareas de cocina</h2><p>{dateLabel(dailyDate)}</p></div><span className="lp-production-count">{dailyTasks.length}</span></div>
            <div className="lp-production-day-picker"><button type="button" className="lp-button lp-secondary" onClick={previousDay}>← Día anterior</button><label>Fecha<input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}/></label><button type="button" className="lp-button lp-secondary" onClick={nextDay}>Día siguiente →</button><button type="button" className="lp-button lp-secondary" onClick={() => window.print()}><Printer size={15}/> Imprimir día</button></div>
            {!dailyTasks.length ? <div className="lp-week-empty"><CalendarDays size={26}/><strong>No hay tareas para este día</strong><span>Prueba otra fecha o ajusta las fechas de preparación en la vista por evento.</span></div> :
              <div className="lp-production-task-list">{dailyTasks.map(task => {
                const event = events.find(item => item.id === task.event_id);
                return <article key={task.id} className="lp-production-task"><div className="lp-production-task-main"><div className="lp-production-task-title"><span className={task.recipe_type === "intermediate" ? "lp-production-kind intermediate" : "lp-production-kind"}>{task.recipe_type === "intermediate" ? "Elaboración intermedia" : "Plato final"}</span><h3>{task.recipe_title}</h3><p>{event?.title || "Evento"} · {event?.guest_count || "—"} pax · {task.quantity_label}</p></div><button type="button" className="lp-button lp-secondary" onClick={() => { setSelectedEventId(task.event_id); setActiveView("events"); }}><ArrowRight size={15}/> Ver evento</button></div><div className="lp-production-task-controls"><label>Estado<select value={task.status} disabled={!isAdmin} onChange={e => void updateTask(task, { status: e.target.value as ProductionTask["status"] })}>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{isAdmin && <label>Fecha de preparación<input type="date" value={task.production_date} onChange={e => void updateTask(task, { production_date: e.target.value })}/></label>}</div></article>;
              })}</div>}
          </section>}
          <p className="lp-production-footnote">Las cantidades se calculan a partir de las recetas y el menú. Las tareas guardan una copia de la ficha técnica usada al generar el plan, para que las modificaciones posteriores de una receta no cambien el evento sin revisión. No se calculan precios ni se generan pedidos.</p>
        </div>
      </div>
    </main>
  );
}
