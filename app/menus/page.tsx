"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, Session } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, ChefHat, ClipboardList, ChevronLeft, ChevronRight, Edit3, Filter, Plus, Printer, Save, Search, Trash2, Utensils, X } from "lucide-react";
import ModuleNavigation from "@/components/module-navigation";
import AppHeader from "@/components/app-header";

type Profile = { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean };
type Recipe = { id: string; title: string; category: string; recipe_type: "final" | "intermediate"; servings: number; status: "draft" | "published" | "archived"; photo_url: string | null; tags: string[] };
type MenuItem = { id?: string; recipe_id: string; course: string; section_name: string; selection_count: number | null; sort_order: number; recipe?: Recipe };
type MenuRecord = { id: string; title: string; description: string; theme_label: string; menu_type: "semanal" | "tematico" | "evento" | "otro"; status: "draft" | "published"; created_at: string; menu_items: Array<MenuItem & { recipes?: Recipe | null }> };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const courses = ["Aperitivo", "Entrante", "Principal", "Guarnición", "Postre", "Otro"];
const menuTypes = [{ value: "semanal", label: "Semanal / Fin de semana" }, { value: "tematico", label: "Temático" }, { value: "evento", label: "Evento" }, { value: "otro", label: "Otro / personalizado" }] as const;
const eventBlocks = [
  { name: "Fríos", defaultCount: 4 },
  { name: "Calientes", defaultCount: 3 },
  { name: "Postres", defaultCount: 2 },
] as const;
type EventBlockName = typeof eventBlocks[number]["name"];
type EventBlockCounts = Record<EventBlockName, number>;
const defaultEventBlockCounts: EventBlockCounts = { "Fríos": 4, "Calientes": 3, "Postres": 2 };
const sectionRank = (section: string) => { const value = section.trim().toLocaleLowerCase("es"); if (["frío", "fríos"].includes(value)) return 0; if (["caliente", "calientes"].includes(value)) return 1; if (["postre", "postres"].includes(value)) return 2; if (["estación", "estaciones"].includes(value)) return 3; return 4; };
const catalogSection = (category: string, menuType: "semanal" | "tematico" | "evento" | "otro", course: string) => { const value = category.trim().toLocaleLowerCase("es"); if (value === "frío" || value === "frio") return "Fríos"; if (value === "caliente") return "Calientes"; if (value === "postre") return "Postres"; if (value === "estación" || value === "estacion") return "Estaciones"; if (course === "Postre") return "Postres"; if (menuType === "evento") return ["Principal", "Guarnición"].includes(course) ? "Calientes" : "Fríos"; if (course === "Entrante" || course === "Aperitivo") return "Primeros"; if (course === "Principal" || course === "Guarnición") return "Segundos"; return "Primeros"; };
const sortMenuItems = <T extends { section_name?: string; course?: string; sort_order: number; recipe?: { category?: string; title?: string } | null; recipes?: { category?: string; title?: string } | null }>(items: T[]) => [...items].sort((a,b) => { const sectionA = a.section_name || a.recipe?.category || a.recipes?.category || a.course || "Otros"; const sectionB = b.section_name || b.recipe?.category || b.recipes?.category || b.course || "Otros"; return sectionRank(sectionA)-sectionRank(sectionB) || a.sort_order-b.sort_order || String(a.recipe?.title || a.recipes?.title || "").localeCompare(String(b.recipe?.title || b.recipes?.title || ""), "es"); });
const blankForm = () => ({ title: "", description: "", theme_label: "", menu_type: "semanal" as "semanal" | "tematico" | "evento" | "otro", status: "draft" as "draft" | "published", items: [] as MenuItem[] });

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(value));
}

export default function MenusPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeTargetSection, setRecipeTargetSection] = useState<EventBlockName>("Fríos");
  const [eventBlockCounts, setEventBlockCounts] = useState<EventBlockCounts>(defaultEventBlockCounts);
  const [dishPickerOpen, setDishPickerOpen] = useState(false);
  const [pendingRecipeIds, setPendingRecipeIds] = useState<string[]>([]);
  const [validationMessage, setValidationMessage] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [menuTypeFilter, setMenuTypeFilter] = useState("todos");
  const [menuStatusFilter, setMenuStatusFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [viewingMenuId, setViewingMenuId] = useState<string | null>(null);
  const [printMenuId, setPrintMenuId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setProfile(null); setLoading(false); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    const [{ data: p, error: profileError }, { data: recipeRows, error: recipeError }, { data: menuRows, error: menuError }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,role,active").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("recipes").select("id,title,category,recipe_type,servings,status,photo_url,tags").neq("status", "archived").order("title"),
      supabase.from("menus").select("id,title,description,theme_label,menu_type,status,created_at,menu_items(id,recipe_id,course,section_name,selection_count,sort_order,recipes(id,title,category,recipe_type,servings,status,photo_url,tags))").order("created_at", { ascending: false })
    ]);
    if (profileError || !p) setNotice("No se pudo cargar tu perfil. Comprueba tu cuenta en La Partida.");
    else setProfile(p as Profile);
    if (recipeError) setNotice("No se pudieron cargar las recetas: " + recipeError.message);
    else setRecipes((recipeRows || []) as Recipe[]);
    if (menuError) setNotice("No se pudieron cargar los menús: " + menuError.message);
    else setMenus((menuRows || []) as unknown as MenuRecord[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { if (session) void refresh(); else { setMenus([]); setRecipes([]); } }, [session, refresh]);

  useEffect(() => {
    if (!printMenuId) return;
    const afterPrint = () => setPrintMenuId(null);
    window.addEventListener("afterprint", afterPrint);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", afterPrint); };
  }, [printMenuId]);

  const availableRecipes = useMemo(() => recipes.filter(recipe =>
    recipe.recipe_type === "final" &&
    (isAdmin || recipe.status === "published") &&
    (recipe.title + " " + recipe.category + " " + (recipe.tags || []).join(" ")).toLocaleLowerCase("es").includes(recipeSearch.trim().toLocaleLowerCase("es"))
  ), [recipes, isAdmin, recipeSearch]);

  const filteredMenus = useMemo(() => menus.filter(menu => {
    const search = menuSearch.trim().toLocaleLowerCase("es");
    const matchesSearch = !search || [menu.title, menu.description, menu.theme_label, menuTypes.find(type => type.value === menu.menu_type)?.label || menu.menu_type].join(" ").toLocaleLowerCase("es").includes(search);
    return matchesSearch && (menuTypeFilter === "todos" || menu.menu_type === menuTypeFilter) && (menuStatusFilter === "todos" || menu.status === menuStatusFilter);
  }), [menus, menuSearch, menuTypeFilter, menuStatusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredMenus.length / pageSize));
  const pageMenus = filteredMenus.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const viewingMenu = menus.find(menu => menu.id === viewingMenuId) || null;

  useEffect(() => { setCurrentPage(1); }, [menuSearch, menuTypeFilter, menuStatusFilter, pageSize]);
  useEffect(() => { setCurrentPage(page => Math.min(page, pageCount)); }, [pageCount]);

  const startNew = () => {
    setEditingId(null);
    setForm(blankForm());
    setRecipeSearch("");
    setRecipeTargetSection("Fríos");
    setEventBlockCounts({ ...defaultEventBlockCounts });
    setDishPickerOpen(false);
    setPendingRecipeIds([]);
    setValidationMessage("");
    setFormOpen(true);
    setNotice("");
  };
  const startEdit = (menu: MenuRecord) => {
    const menuType = menu.menu_type || "semanal";
    const savedItems = sortMenuItems(menu.menu_items || []);
    const counts: EventBlockCounts = {
      "Fríos": savedItems.find(item => item.section_name === "Fríos")?.selection_count ?? 4,
      "Calientes": savedItems.find(item => item.section_name === "Calientes")?.selection_count ?? 3,
      "Postres": savedItems.find(item => item.section_name === "Postres")?.selection_count ?? 2
    };
    setEditingId(menu.id);
    setRecipeTargetSection("Fríos");
    setEventBlockCounts(counts);
    setDishPickerOpen(false);
    setPendingRecipeIds([]);
    setValidationMessage("");
    setForm({
      title: menu.title,
      description: menu.description || "",
      theme_label: menu.theme_label || "",
      menu_type: menuType,
      status: menu.status,
      items: savedItems.map(item => {
        const sectionName = item.section_name || item.course || "Otros";
        const defaultCount = menuType === "evento"
          ? sectionName === "Fríos" ? counts["Fríos"] : sectionName === "Calientes" ? counts["Calientes"] : sectionName === "Postres" ? counts["Postres"] : null
          : null;
        return {
          recipe_id: item.recipe_id,
          course: item.course,
          section_name: sectionName,
          selection_count: menuType === "evento" ? defaultCount : item.selection_count ?? null,
          sort_order: item.sort_order,
          recipe: item.recipes || undefined
        };
      })
    });
    setRecipeSearch("");
    setFormOpen(true);
    setNotice("");
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(blankForm());
    setDishPickerOpen(false);
    setPendingRecipeIds([]);
    setValidationMessage("");
  };
  const addRecipe = (recipeId: string) => {
    if (!recipeId || form.items.some(item => item.recipe_id === recipeId)) return;
    const recipe = recipes.find(item => item.id === recipeId);
    if (!recipe) return;
    const defaultCourse = courses.includes(recipe.category) ? recipe.category : "Otro";
    setForm(current => ({ ...current, items: [...current.items, {
      recipe_id: recipe.id,
      course: defaultCourse,
      section_name: catalogSection(recipe.category, current.menu_type, defaultCourse),
      selection_count: null,
      sort_order: current.items.length,
      recipe
    }] }));
  };
  const addSelectedEventRecipes = () => {
    const selectedIds = [...pendingRecipeIds];
    setForm(current => {
      const existingIds = new Set(current.items.map(item => item.recipe_id));
      const additions = selectedIds
        .filter(id => !existingIds.has(id))
        .map(id => recipes.find(recipe => recipe.id === id))
        .filter((recipe): recipe is Recipe => Boolean(recipe))
        .map(recipe => ({
          recipe_id: recipe.id,
          course: courses.includes(recipe.category) ? recipe.category : "Otro",
          section_name: recipeTargetSection,
          selection_count: eventBlockCounts[recipeTargetSection],
          sort_order: current.items.length,
          recipe
        }));
      return { ...current, items: [...current.items, ...additions].map((item,index) => ({ ...item, sort_order: index })) };
    });
    setDishPickerOpen(false);
    setPendingRecipeIds([]);
    setRecipeSearch("");
  };
  const changeItem = (index: number, patch: Partial<MenuItem>) => setForm(current => {
    const target = current.items[index];
    if (!target) return current;
    if (Object.prototype.hasOwnProperty.call(patch, "selection_count")) {
      return { ...current, items: current.items.map(item => item.section_name === target.section_name ? { ...item, ...patch } : item) };
    }
    return { ...current, items: current.items.map((item,i) => i === index ? { ...item, ...patch } : item) };
  });
  const moveItem = (index: number, direction: -1 | 1) => setForm(current => {
    const next = [...current.items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, items: next.map((item,i) => ({ ...item, sort_order: i })) };
  });
  const removeItem = (index: number) => setForm(current => ({ ...current, items: current.items.filter((_,i) => i !== index).map((item,i) => ({ ...item, sort_order: i })) }));

  const saveMenu = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !session || !profile?.active || !isAdmin) return;
    if (form.menu_type === "otro" && !form.theme_label.trim()) {
      setValidationMessage("Indica el nombre de la categoría personalizada antes de guardar.");
      return;
    }
    const sectionGroups = new Map<string, MenuItem[]>();
    form.items.forEach(item => {
      const name = item.section_name.trim() || "Otros";
      sectionGroups.set(name, [...(sectionGroups.get(name) || []), item]);
    });
    const validationErrors: string[] = [];
    if (form.menu_type === "evento") {
      eventBlocks.forEach(block => {
        const available = form.items.filter(item => item.section_name === block.name).length;
        const requested = eventBlockCounts[block.name];
        if (available < requested) {
          validationErrors.push(`${block.name}: el evento está configurado para ${requested} pasos a elegir, pero solo has añadido ${available} platos. Añade al menos ${requested - available} plato(s) más o reduce el número de pasos.`);
        }
      });
    } else {
      sectionGroups.forEach((items, name) => {
        const counts = new Set(items.map(item => item.selection_count ?? null));
        if (counts.size > 1) validationErrors.push(`El bloque «${name}» tiene reglas de elección distintas. Usa el mismo número para todo el bloque.`);
        const count = items[0]?.selection_count;
        if (count !== null && count !== undefined && count > items.length) {
          validationErrors.push(`El bloque «${name}» permite elegir ${count}, pero solo tiene ${items.length} recetas.`);
        }
      });
    }
    if (form.items.length === 0 && form.menu_type !== "evento") {
      validationErrors.push("Añade al menos una receta al menú.");
    }
    if (validationErrors.length > 0) {
      setValidationMessage(validationErrors.join("\n\n"));
      return;
    }
    setSaving(true); setNotice("");
    const payload = { title: form.title.trim(), description: form.description.trim(), theme_label: form.theme_label.trim(), menu_type: form.menu_type, status: form.status, updated_at: new Date().toISOString() };
    let menuId = editingId;
    if (menuId) {
      const { error } = await supabase.from("menus").update(payload).eq("id", menuId);
      if (error) { setNotice("No se pudo actualizar el menú: " + error.message); setSaving(false); return; }
      const { error: removeError } = await supabase.from("menu_items").delete().eq("menu_id", menuId);
      if (removeError) { setNotice("No se pudieron actualizar las recetas del menú: " + removeError.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("menus").insert({ ...payload, created_by: session.user.id }).select("id").single();
      if (error || !data) { setNotice("No se pudo crear el menú: " + (error?.message || "Error desconocido")); setSaving(false); return; }
      menuId = data.id;
    }
    const { error: itemsError } = await supabase.from("menu_items").insert(form.items.map((item,index) => ({ menu_id: menuId, recipe_id: item.recipe_id, course: item.course, section_name: item.section_name.trim() || "Otros", selection_count: item.selection_count, sort_order: index })));
    if (itemsError) {
      setNotice("El menú se guardó, pero no se pudieron guardar sus recetas: " + itemsError.message);
      setSaving(false);
      return;
    }
    setNotice(form.status === "published" ? "Menú guardado y publicado." : "Menú guardado como borrador.");
    closeForm();
    await refresh();
    setSaving(false);
  };

  const deleteMenu = async (menu: MenuRecord) => {
    if (!supabase || !isAdmin || !window.confirm(`¿Eliminar el menú «${menu.title}»? Las recetas originales no se borrarán.`)) return;
    const { error } = await supabase.from("menus").delete().eq("id", menu.id);
    if (error) setNotice("No se pudo eliminar el menú: " + error.message);
    else { setViewingMenuId(null); setNotice("Menú eliminado. Las recetas originales siguen en el recetario."); await refresh(); }
  };

  if (!supabase) return <main className="lp-page"><section className="lp-card lp-login"><ChefHat size={30}/><h1>La Partida</h1><p>Falta configurar la conexión con Supabase.</p></section></main>;
  if (loading) return <main className="lp-page"><div className="lp-loading">Cargando menús…</div></main>;
  if (!session) return <main className="lp-center lp-logged-out"><section className="lp-card lp-login"><div className="lp-logo"><ChefHat size={30}/></div><h1>Menús</h1><p>Inicia sesión en La Partida para continuar.</p><Link className="lp-button lp-primary lp-link-button" href="/">Volver al inicio para iniciar sesión</Link></section></main>;
  if (!profile?.active) return <main className="lp-page"><section className="lp-card lp-login"><h1>Acceso no disponible</h1><p>Tu cuenta no tiene un perfil activo.</p><Link href="/">Volver al inicio</Link></section></main>;

  return (
    <main className="lp-page lp-menus-screen">
      <AppHeader fullName={profile.full_name || session.user.email || "Usuario"} role={profile.role} onLogout={() => void supabase?.auth.signOut()} />
      <ModuleNavigation activeModule="menus" />
      <div className="lp-content">
        <div className="lp-heading"><div><span className="lp-kicker">ORGANIZACIÓN DE COCINA</span><h1>Menús</h1><p>Crea propuestas combinando las recetas del recetario, sin duplicar fichas.</p></div>{isAdmin && <button className="lp-button lp-primary" onClick={startNew}><Plus size={16}/> Crear menú</button>}</div>
        {notice && <div className="lp-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={15}/></button></div>}
        {formOpen && isAdmin && <div className="lp-menu-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !saving) closeForm();}}><form className="lp-card lp-menu-form lp-menu-modal" role="dialog" aria-modal="true" aria-labelledby="lp-menu-form-title" onSubmit={saveMenu}>
          <div className="lp-card-title"><div><span className="lp-kicker">{editingId ? "EDITAR MENÚ" : "NUEVO MENÚ"}</span><h2 id="lp-menu-form-title">{editingId ? "Editar propuesta" : "Crear un menú"}</h2></div><button type="button" className="lp-icon-button" onClick={closeForm} aria-label="Cerrar formulario"><X size={17}/></button></div>
          <div className="lp-menu-modal-body">
          <div className="lp-menu-fields">
            <label>Tipo de menú<select value={form.menu_type} onChange={e=>{const menuType=e.target.value as "semanal"|"tematico"|"evento"|"otro";setForm(current=>({...current,menu_type:menuType}));if(menuType==="evento"){setEventBlockCounts({...defaultEventBlockCounts});setRecipeTargetSection("Fríos");}}}>{menuTypes.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label>Nombre del menú *<input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Una fuerza del pasado"/></label>
            <label>{form.menu_type === "otro" ? "Nombre de la categoría *" : form.menu_type === "evento" ? "Tipo de evento o etiqueta (opcional)" : "Etiqueta temática (opcional)"}<input maxLength={100} required={form.menu_type === "otro"} value={form.theme_label} onChange={e=>setForm({...form,theme_label:e.target.value})} placeholder={form.menu_type === "otro" ? "Ej. Navidad, Infantil, Corporativo…" : form.menu_type === "evento" ? "Ej. Boda, cóctel, evento de empresa…" : "Ej. Una fuerza del pasado"}/></label>
            <label className="wide">Descripción<textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Concepto, temporada o contexto del menú…"/></label>
            <label>Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as "draft"|"published"})}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
          </div>
          {form.menu_type === "evento" ? (
            <section className="lp-event-editor">
              <div className="lp-menu-section-head">
                <div>
                  <h3><Utensils size={17}/> Bloques del evento</h3>
                  <p>Configura cuántos pasos podrá elegir el cliente. Añade las opciones que quieras a cada bloque.</p>
                </div>
              </div>
              <div className="lp-event-blocks">
                {eventBlocks.map(block => {
                  const selectedItems = form.items.map((item,index) => ({ item,index })).filter(entry => entry.item.section_name === block.name);
                  return <section className="lp-event-block-card" key={block.name}>
                    <div className="lp-event-block-heading">
                      <h4>{block.name.toLocaleUpperCase("es")}</h4>
                      <span>{selectedItems.length} platos</span>
                    </div>
                    <label>Número de pasos
                      <select value={eventBlockCounts[block.name]} onChange={e => {
                        const count = Number(e.target.value);
                        setEventBlockCounts(current => ({ ...current, [block.name]: count }));
                        setForm(current => ({ ...current, items: current.items.map(item => item.section_name === block.name ? { ...item, selection_count: count } : item) }));
                      }}>
                        {Array.from({ length: 20 }, (_,index) => index + 1).map(count => <option key={count} value={count}>{count}</option>)}
                      </select>
                    </label>
                    <div className="lp-event-picked-dishes">
                      {selectedItems.length === 0
                        ? <p className="lp-event-empty-dishes">Todavía no has añadido platos a este bloque.</p>
                        : selectedItems.map(({item,index}) => <div className="lp-event-picked-dish" key={item.recipe_id}>
                            <span>{item.recipe?.title || recipes.find(recipe => recipe.id === item.recipe_id)?.title || "Plato"}</span>
                            <button type="button" className="lp-icon-button" onClick={() => removeItem(index)} aria-label={`Quitar ${item.recipe?.title || "plato"} de ${block.name}`}><Trash2 size={15}/></button>
                          </div>)
                      }
                    </div>
                    <button type="button" className="lp-button lp-secondary lp-event-add-dish" onClick={() => {
                      setRecipeTargetSection(block.name);
                      setRecipeSearch("");
                      setPendingRecipeIds([]);
                      setDishPickerOpen(true);
                    }}><Plus size={15}/> Añadir platos</button>
                  </section>;
                })}
              </div>
            </section>
          ) : (
            <>
              <div className="lp-menu-section-head"><div><h3><BookOpen size={17}/> Añadir recetas</h3><p>Selecciona una receta existente. No se copia ni se crea otra ficha.</p></div><span>{form.items.length} pases</span></div>
              <label className="lp-menu-search">Buscar receta<input value={recipeSearch} onChange={e=>setRecipeSearch(e.target.value)} placeholder="Nombre, categoría o etiqueta…"/></label>
              <div className="lp-menu-picker">
                {availableRecipes.filter(recipe=>!form.items.some(item=>item.recipe_id===recipe.id)).map(recipe=><button type="button" key={recipe.id} className="lp-menu-recipe-option" onClick={()=>addRecipe(recipe.id)}><Plus size={15}/><span><strong>{recipe.title}</strong><small>{recipe.category} · {recipe.servings} pax · {recipe.status==="published"?"Publicada":"Borrador"}</small></span></button>)}
                {!availableRecipes.filter(recipe=>!form.items.some(item=>item.recipe_id===recipe.id)).length && <p className="lp-muted small-text">No hay más recetas disponibles con esta búsqueda.</p>}
              </div>
              <div className="lp-menu-section-head"><div><h3><Utensils size={17}/> Bloques y elección de platos</h3><p>En menús semanales y temáticos se proponen Primeros, Segundos y Postres. Puedes editar el bloque de cada receta.</p></div></div>
              {!form.items.length ? <div className="lp-week-empty"><ClipboardList size={26}/><strong>Aún no hay pases</strong><span>Añade recetas en el apartado anterior.</span></div> : <div className="lp-menu-items">{form.items.map((item,index)=><article className="lp-menu-item" key={item.recipe_id}><div className="lp-menu-item-order"><button type="button" className="lp-icon-button" onClick={()=>moveItem(index,-1)} disabled={index===0} aria-label="Mover receta arriba"><ArrowUp size={15}/></button><span>{index+1}</span><button type="button" className="lp-icon-button" onClick={()=>moveItem(index,1)} disabled={index===form.items.length-1} aria-label="Mover receta abajo"><ArrowDown size={15}/></button></div><div className="lp-menu-item-name"><strong>{item.recipe?.title || recipes.find(recipe=>recipe.id===item.recipe_id)?.title || "Receta"}</strong><small>{item.recipe?.servings || recipes.find(recipe=>recipe.id===item.recipe_id)?.servings || "—"} pax en la ficha original</small></div><label>Bloque<input value={item.section_name} maxLength={80} onChange={e=>changeItem(index,{section_name:e.target.value})} placeholder="Ej. Primeros"/></label><label>Elección del bloque<select value={item.selection_count===null?"all":String(item.selection_count)} onChange={e=>changeItem(index,{selection_count:e.target.value==="all"?null:Number(e.target.value)})}><option value="all">Todos los platos</option>{Array.from({length:form.items.filter(row=>row.section_name===item.section_name).length},(_,i)=>i+1).map(n=><option key={n} value={n}>Elegir {n} de {form.items.filter(row=>row.section_name===item.section_name).length}</option>)}</select></label><label>Pase<select value={item.course} onChange={e=>changeItem(index,{course:e.target.value})}>{courses.map(course=><option key={course}>{course}</option>)}</select></label><button type="button" className="lp-icon-button lp-menu-remove" onClick={()=>removeItem(index)} aria-label="Quitar receta del menú"><Trash2 size={15}/></button></article>)}</div>}
            </>
          )}
          </div>
          <div className="lp-recipe-form-actions"><button type="button" className="lp-button lp-secondary" onClick={closeForm}>Cancelar</button><button type="submit" className="lp-button lp-primary" disabled={saving}><Save size={16}/>{saving?"Guardando…":"Guardar menú"}</button></div>
        </form></div>}
        {dishPickerOpen && formOpen && form.menu_type === "evento" && <div className="lp-dish-picker-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { setDishPickerOpen(false); setPendingRecipeIds([]); setRecipeSearch(""); } }}>
          <section className="lp-dish-picker-modal" role="dialog" aria-modal="true" aria-labelledby="lp-dish-picker-title">
            <header className="lp-dish-picker-header">
              <div><span className="lp-kicker">AÑADIR OPCIONES</span><h2 id="lp-dish-picker-title">Seleccionar platos para {recipeTargetSection}</h2><p>Marca todos los platos que quieras incluir en este bloque.</p></div>
              <button type="button" className="lp-icon-button" onClick={() => { setDishPickerOpen(false); setPendingRecipeIds([]); setRecipeSearch(""); }} aria-label="Cerrar selección"><X size={17}/></button>
            </header>
            <label className="lp-dish-picker-search"><Search size={16}/><input autoFocus value={recipeSearch} onChange={e=>setRecipeSearch(e.target.value)} placeholder="Buscar por nombre, categoría o etiqueta…"/></label>
            <div className="lp-dish-picker-list">
              {availableRecipes.filter(recipe => !form.items.some(item => item.recipe_id === recipe.id)).map(recipe => <label className="lp-dish-picker-option" key={recipe.id}>
                <input type="checkbox" checked={pendingRecipeIds.includes(recipe.id)} onChange={e => setPendingRecipeIds(current => e.target.checked ? [...current,recipe.id] : current.filter(id => id !== recipe.id))}/>
                <span><strong>{recipe.title}</strong><small>{recipe.category} · {recipe.servings} pax · {recipe.status === "published" ? "Publicada" : "Borrador"}</small></span>
              </label>)}
              {!availableRecipes.filter(recipe => !form.items.some(item => item.recipe_id === recipe.id)).length && <p className="lp-muted small-text">No hay más platos disponibles con esta búsqueda.</p>}
            </div>
            <footer className="lp-dish-picker-actions"><span>{pendingRecipeIds.length} platos seleccionados</span><button type="button" className="lp-button lp-secondary" onClick={() => { setDishPickerOpen(false); setPendingRecipeIds([]); setRecipeSearch(""); }}>Cancelar</button><button type="button" className="lp-button lp-primary" disabled={!pendingRecipeIds.length} onClick={addSelectedEventRecipes}>Añadir seleccionados</button></footer>
          </section>
        </div>}
        {validationMessage && <div className="lp-validation-backdrop">
          <section className="lp-validation-modal" role="alertdialog" aria-modal="true" aria-labelledby="lp-validation-title">
            <div className="lp-validation-icon"><X size={20}/></div>
            <h2 id="lp-validation-title">No se puede guardar el menú</h2>
            <p>Corrige estos puntos antes de continuar:</p>
            <ul>{validationMessage.split("\n\n").map((message,index) => <li key={index}>{message}</li>)}</ul>
            <button type="button" className="lp-button lp-primary" onClick={() => setValidationMessage("")}>Volver al menú</button>
          </section>
        </div>}
        {loading ? <div className="lp-week-empty">Cargando menús…</div> : menus.length === 0 ? <section className="lp-card lp-menu-empty"><Utensils size={30}/><h2>Todavía no hay menús</h2><p>{isAdmin?"Crea el primero con recetas que ya existen en el recetario.":"Cuando se publique un menú, aparecerá aquí."}</p>{isAdmin && <button className="lp-button lp-primary" onClick={startNew}><Plus size={16}/> Crear primer menú</button>}</section> : <><section className="lp-menu-filters" aria-label="Buscar y filtrar menús"><label className="lp-menu-filter-search"><Search size={17}/><input value={menuSearch} onChange={e=>setMenuSearch(e.target.value)} placeholder="Buscar por nombre, descripción o etiqueta…"/></label><label><Filter size={15}/> Tipo<select value={menuTypeFilter} onChange={e=>setMenuTypeFilter(e.target.value)}><option value="todos">Todos los tipos</option>{menuTypes.map(type=><option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label><Filter size={15}/> Estado<select value={menuStatusFilter} onChange={e=>setMenuStatusFilter(e.target.value)}><option value="todos">Todos los estados</option><option value="published">Publicados</option><option value="draft">Borradores</option></select></label><span className="lp-menu-filter-count">{filteredMenus.length} de {menus.length} menús</span></section>{filteredMenus.length === 0 ? <section className="lp-card lp-menu-empty"><Search size={28}/><h2>No hay resultados</h2><p>Prueba con otra búsqueda o cambia los filtros.</p><button type="button" className="lp-button lp-secondary" onClick={()=>{setMenuSearch("");setMenuTypeFilter("todos");setMenuStatusFilter("todos");}}>Limpiar filtros</button></section> : <>
          <section className="lp-menu-grid lp-menu-grid-compact">
            {pageMenus.map(menu => {
              const items = sortMenuItems(menu.menu_items || []);
              const sections = Array.from(new Set(items.map(item => item.section_name || item.course || "Otros")));
              const typeLabel = menu.menu_type === "otro" ? (menu.theme_label || "Otro / personalizado") : (menuTypes.find(type => type.value === menu.menu_type)?.label || "Semanal / Fin de semana");
              return <article className="lp-card lp-menu-card lp-menu-card-compact" key={menu.id} role="button" tabIndex={0} aria-label={`Ver menú ${menu.title}`} onClick={() => setViewingMenuId(menu.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewingMenuId(menu.id); } }}>
                <div className="lp-menu-card-top"><span className={`lp-recipe-status ${menu.status}`}>{menu.status === "published" ? "Publicado" : "Borrador"}</span><span className="lp-menu-theme">{typeLabel}</span></div>
                <h2>{menu.title}</h2>
                <p className="lp-menu-card-description">{menu.description || "Sin descripción"}</p>
                {menu.theme_label && menu.menu_type !== "otro" && <p className="lp-menu-card-label">{menu.theme_label}</p>}
                <div className="lp-menu-card-summary"><span><BookOpen size={14}/>{items.length} {items.length === 1 ? "receta" : "recetas"}</span><span><Utensils size={14}/>{sections.length} {sections.length === 1 ? "bloque" : "bloques"}</span></div>
                <div className="lp-menu-card-footer"><span>{dateLabel(menu.created_at)}</span><div><button type="button" className="lp-button lp-secondary" onClick={event => { event.stopPropagation(); setPrintMenuId(menu.id); }}><Printer size={14}/> Imprimir</button><button type="button" className="lp-button lp-primary" onClick={event => { event.stopPropagation(); setViewingMenuId(menu.id); }}><BookOpen size={14}/> Ver menú</button></div></div>
              </article>;
            })}
          </section>
          <nav className="lp-menu-pagination" aria-label="Paginación de menús">
            <span>Mostrando {filteredMenus.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredMenus.length)} de {filteredMenus.length} menús</span>
            <div className="lp-menu-pagination-controls">
              <label>Por página<select value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[4,8,12,16,20,24].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
              <button type="button" className="lp-icon-button" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}><ChevronLeft size={17}/></button>
              <strong>Página {currentPage} de {pageCount}</strong>
              <button type="button" className="lp-icon-button" aria-label="Página siguiente" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}><ChevronRight size={17}/></button>
            </div>
          </nav>
        </>}
        {viewingMenu && <div className="lp-menu-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setViewingMenuId(null); }}>
          <section className="lp-menu-detail-modal" role="dialog" aria-modal="true" aria-labelledby="lp-menu-detail-title">
            <header className="lp-menu-detail-header">
              <div><span className="lp-kicker">DETALLE DEL MENÚ</span><h2 id="lp-menu-detail-title">{viewingMenu.title}</h2><div className="lp-menu-detail-badges"><span className={`lp-recipe-status ${viewingMenu.status}`}>{viewingMenu.status === "published" ? "Publicado" : "Borrador"}</span><span className="lp-menu-theme">{viewingMenu.menu_type === "otro" ? (viewingMenu.theme_label || "Otro / personalizado") : (menuTypes.find(type => type.value === viewingMenu.menu_type)?.label || "Semanal / Fin de semana")}</span></div></div>
              <button type="button" className="lp-icon-button" onClick={() => setViewingMenuId(null)} aria-label="Cerrar detalle"><X size={17}/></button>
            </header>
            <div className="lp-menu-detail-body">
              {viewingMenu.description && <p className="lp-menu-detail-description">{viewingMenu.description}</p>}
              <div className="lp-menu-detail-meta">
                <div><small>Tipo de menú</small><strong>{viewingMenu.menu_type === "otro" ? "Otro / personalizado" : (menuTypes.find(type => type.value === viewingMenu.menu_type)?.label || "Semanal / Fin de semana")}</strong></div>
                {viewingMenu.theme_label && <div><small>Etiqueta</small><strong>{viewingMenu.theme_label}</strong></div>}
                <div><small>Estado</small><strong>{viewingMenu.status === "published" ? "Publicado" : "Borrador"}</strong></div>
                <div><small>Creado</small><strong>{dateLabel(viewingMenu.created_at)}</strong></div>
                <div><small>Recetas</small><strong>{(viewingMenu.menu_items || []).length}</strong></div>
              </div>
              <div className="lp-menu-detail-recipes">
                <div className="lp-menu-detail-section-heading"><h3>Catálogo de platos</h3><span>{(viewingMenu.menu_items || []).length} opciones</span></div>
                {!viewingMenu.menu_items?.length ? <p className="lp-muted small-text">Este menú todavía no tiene recetas.</p> : sortMenuItems(viewingMenu.menu_items || []).reduce<Array<{name:string;items:Array<MenuItem & {recipes?:Recipe|null}>}>>((groups,item) => {
                  const name = item.section_name || item.course || "Otros";
                  const found = groups.find(group => group.name === name);
                  if (found) found.items.push(item); else groups.push({ name, items: [item] });
                  return groups;
                }, []).map(group => {
                  const chosen = group.items[0]?.selection_count;
                  return <section className="lp-menu-detail-group" key={group.name}><header><h4>{group.name}</h4><span>{chosen ? `Elegir ${chosen} de ${group.items.length}` : `${group.items.length} opciones`}</span></header><ul>{group.items.map(item => <li key={item.id || item.recipe_id}><span>{item.recipes?.title || item.recipe?.title || "Receta no disponible"}</span><small>{item.course || "Pase"}{item.recipes?.category ? ` · ${item.recipes.category}` : ""}</small></li>)}</ul></section>;
                })}
              </div>
            </div>
            <footer className="lp-menu-detail-actions">
              <button type="button" className="lp-button lp-secondary" onClick={() => setViewingMenuId(null)}>Cerrar</button>
              <button type="button" className="lp-button lp-secondary" onClick={() => setPrintMenuId(viewingMenu.id)}><Printer size={15}/> Imprimir</button>
              {isAdmin && <button type="button" className="lp-button lp-danger" onClick={() => void deleteMenu(viewingMenu)}><Trash2 size={15}/> Eliminar</button>}
              {isAdmin && <button type="button" className="lp-button lp-primary" onClick={() => { const menu = viewingMenu; setViewingMenuId(null); startEdit(menu); }}><Edit3 size={15}/> Editar menú</button>}
            </footer>
          </section>
        </div>}
        <footer className="lp-footer">La Partida - Gestión de Cocina</footer>
        {printMenuId && (() => { const menu = menus.find(item => item.id === printMenuId); if (!menu) return null; const items = sortMenuItems(menu.menu_items || []); return <section className="lp-menu-print-bundle" aria-hidden="true"><header><p className="lp-kicker">LA PARTIDA · MENÚ</p><h1>{menu.title}</h1>{menu.theme_label && <p className="lp-menu-print-theme">{menu.theme_label}</p>}{menu.description && <p className="lp-menu-print-description">{menu.description}</p>}</header><div>{Array.from(new Set(items.map(item=>item.section_name || item.course || "Otros"))).map(section=>{const grouped=items.filter(item=>(item.section_name || item.course || "Otros")===section);const chosen=grouped[0]?.selection_count;return <section key={section}><h2>{section}{chosen ? ` · Elegir ${chosen} de ${grouped.length}` : ""}</h2><ol>{grouped.map((item,index)=><li key={item.id || item.recipe_id}><span>{item.course || "Pase"}</span><div><h3>{item.recipes?.title || item.recipe?.title || "Receta no disponible"}</h3>{item.recipes?.category && <p>{item.recipes.category}</p>}</div><strong>{index+1}</strong></li>)}</ol></section>})}</div><footer>La Partida · {items.length} {items.length===1?"receta":"recetas"}</footer></section>; })()}
      </div>
    </main>
  );
}
