"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, Session } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, ChefHat, ClipboardList, Edit3, Plus, Save, Trash2, Utensils, X } from "lucide-react";
import ModuleNavigation from "@/components/module-navigation";

type Profile = { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean };
type Recipe = { id: string; title: string; category: string; servings: number; status: "draft" | "published" | "archived"; photo_url: string | null; tags: string[] };
type MenuItem = { id?: string; recipe_id: string; course: string; sort_order: number; recipe?: Recipe };
type MenuRecord = { id: string; title: string; description: string; theme_label: string; status: "draft" | "published"; created_at: string; menu_items: Array<MenuItem & { recipes?: Recipe | null }> };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const courses = ["Aperitivo", "Entrante", "Principal", "Guarnición", "Postre", "Otro"];
const blankForm = () => ({ title: "", description: "", theme_label: "", status: "draft" as "draft" | "published", items: [] as MenuItem[] });

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
      supabase.from("recipes").select("id,title,category,servings,status,photo_url,tags").neq("status", "archived").order("title"),
      supabase.from("menus").select("id,title,description,theme_label,status,created_at,menu_items(id,recipe_id,course,sort_order,recipes(id,title,category,servings,status,photo_url,tags))").order("created_at", { ascending: false })
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

  const availableRecipes = useMemo(() => recipes.filter(recipe =>
    (isAdmin || recipe.status === "published") &&
    (recipe.title + " " + recipe.category + " " + (recipe.tags || []).join(" ")).toLocaleLowerCase("es").includes(recipeSearch.trim().toLocaleLowerCase("es"))
  ), [recipes, isAdmin, recipeSearch]);

  const startNew = () => { setEditingId(null); setForm(blankForm()); setRecipeSearch(""); setFormOpen(true); setNotice(""); };
  const startEdit = (menu: MenuRecord) => {
    setEditingId(menu.id);
    setForm({
      title: menu.title,
      description: menu.description || "",
      theme_label: menu.theme_label || "",
      status: menu.status,
      items: [...(menu.menu_items || [])].sort((a,b) => a.sort_order-b.sort_order).map(item => ({
        recipe_id: item.recipe_id,
        course: item.course,
        sort_order: item.sort_order,
        recipe: item.recipes || undefined
      }))
    });
    setRecipeSearch("");
    setFormOpen(true);
    setNotice("");
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setForm(blankForm()); };
  const addRecipe = (recipeId: string) => {
    if (!recipeId || form.items.some(item => item.recipe_id === recipeId)) return;
    const recipe = recipes.find(item => item.id === recipeId);
    if (!recipe) return;
    const defaultCourse = courses.includes(recipe.category) ? recipe.category : "Otro";
    setForm(current => ({ ...current, items: [...current.items, { recipe_id: recipe.id, course: defaultCourse, sort_order: current.items.length, recipe }] }));
  };
  const changeItem = (index: number, patch: Partial<MenuItem>) => setForm(current => ({ ...current, items: current.items.map((item,i) => i === index ? { ...item, ...patch } : item) }));
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
    if (form.items.length === 0) { setNotice("Añade al menos una receta al menú."); return; }
    setSaving(true); setNotice("");
    const payload = { title: form.title.trim(), description: form.description.trim(), theme_label: form.theme_label.trim(), status: form.status, updated_at: new Date().toISOString() };
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
    const { error: itemsError } = await supabase.from("menu_items").insert(form.items.map((item,index) => ({ menu_id: menuId, recipe_id: item.recipe_id, course: item.course, sort_order: index })));
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
    else { setNotice("Menú eliminado. Las recetas originales siguen en el recetario."); await refresh(); }
  };

  if (!supabase) return <main className="lp-page"><section className="lp-card lp-login"><ChefHat size={30}/><h1>La Partida</h1><p>Falta configurar la conexión con Supabase.</p></section></main>;
  if (loading) return <main className="lp-page"><div className="lp-loading">Cargando menús…</div></main>;
  if (!session) return <main className="lp-page"><section className="lp-card lp-login"><ChefHat size={30}/><h1>Menús</h1><p>Inicia sesión en La Partida para continuar.</p><Link className="lp-button lp-primary lp-link-button" href="/">Volver al inicio para iniciar sesión</Link></section></main>;
  if (!profile?.active) return <main className="lp-page"><section className="lp-card lp-login"><h1>Acceso no disponible</h1><p>Tu cuenta no tiene un perfil activo.</p><Link href="/">Volver al inicio</Link></section></main>;

  return (
    <main className="lp-page">
      <header className="lp-topbar"><Link href="/" className="lp-brand"><span className="lp-logo small"><ChefHat size={20}/></span><span className="lp-brand-copy"><strong>La Partida</strong><small>GESTIÓN DE COCINA</small></span></Link><div className="lp-user"><span>{profile.full_name}</span><span className="lp-user-role">{isAdmin ? "Administración" : "Equipo"}</span></div></header>
      <ModuleNavigation activeModule="menus" />
      <div className="lp-content">
        <div className="lp-heading"><div><span className="lp-kicker">ORGANIZACIÓN DE COCINA</span><h1>Menús</h1><p>Crea propuestas combinando las recetas del recetario, sin duplicar fichas.</p></div>{isAdmin && <button className="lp-button lp-primary" onClick={startNew}><Plus size={16}/> Crear menú</button>}</div>
        {notice && <div className="lp-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={15}/></button></div>}
        {formOpen && isAdmin && <form className="lp-card lp-menu-form" onSubmit={saveMenu}>
          <div className="lp-card-title"><div><span className="lp-kicker">{editingId ? "EDITAR MENÚ" : "NUEVO MENÚ"}</span><h2>{editingId ? "Editar propuesta" : "Crear un menú"}</h2></div><button type="button" className="lp-icon-button" onClick={closeForm} aria-label="Cerrar formulario"><X size={17}/></button></div>
          <div className="lp-menu-fields">
            <label>Nombre del menú *<input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Una fuerza del pasado"/></label>
            <label>Etiqueta temática (opcional)<input maxLength={100} value={form.theme_label} onChange={e=>setForm({...form,theme_label:e.target.value})} placeholder="Ej. Una fuerza del pasado"/></label>
            <label className="wide">Descripción<textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Concepto, temporada o contexto del menú…"/></label>
            <label>Estado<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as "draft"|"published"})}><option value="draft">Borrador</option><option value="published">Publicado</option></select></label>
          </div>
          <div className="lp-menu-section-head"><div><h3><BookOpen size={17}/> Añadir recetas</h3><p>Selecciona una receta existente. No se copia ni se crea otra ficha.</p></div><span>{form.items.length} pases</span></div>
          <label className="lp-menu-search">Buscar receta<input value={recipeSearch} onChange={e=>setRecipeSearch(e.target.value)} placeholder="Nombre, categoría o etiqueta…"/></label>
          <div className="lp-menu-picker">
            {availableRecipes.filter(recipe=>!form.items.some(item=>item.recipe_id===recipe.id)).map(recipe=><button type="button" key={recipe.id} className="lp-menu-recipe-option" onClick={()=>addRecipe(recipe.id)}><Plus size={15}/><span><strong>{recipe.title}</strong><small>{recipe.category} · {recipe.servings} pax · {recipe.status==="published"?"Publicada":"Borrador"}</small></span></button>)}
            {!availableRecipes.filter(recipe=>!form.items.some(item=>item.recipe_id===recipe.id)).length && <p className="lp-muted small-text">No hay más recetas disponibles con esta búsqueda.</p>}
          </div>
          <div className="lp-menu-section-head"><div><h3><Utensils size={17}/> Orden del menú</h3><p>Organiza los pases y cambia su categoría cuando lo necesites.</p></div></div>
          {!form.items.length ? <div className="lp-week-empty"><ClipboardList size={26}/><strong>Aún no hay pases</strong><span>Añade recetas en el apartado anterior.</span></div> : <div className="lp-menu-items">{form.items.map((item,index)=><article className="lp-menu-item" key={item.recipe_id}><div className="lp-menu-item-order"><button type="button" className="lp-icon-button" onClick={()=>moveItem(index,-1)} disabled={index===0} aria-label="Mover receta arriba"><ArrowUp size={15}/></button><span>{index+1}</span><button type="button" className="lp-icon-button" onClick={()=>moveItem(index,1)} disabled={index===form.items.length-1} aria-label="Mover receta abajo"><ArrowDown size={15}/></button></div><div className="lp-menu-item-name"><strong>{item.recipe?.title || recipes.find(recipe=>recipe.id===item.recipe_id)?.title || "Receta"}</strong><small>{item.recipe?.servings || recipes.find(recipe=>recipe.id===item.recipe_id)?.servings || "—"} pax en la ficha original</small></div><label>Pase<select value={item.course} onChange={e=>changeItem(index,{course:e.target.value})}>{courses.map(course=><option key={course}>{course}</option>)}</select></label><button type="button" className="lp-icon-button lp-menu-remove" onClick={()=>removeItem(index)} aria-label="Quitar receta del menú"><Trash2 size={15}/></button></article>)}</div>}
          <div className="lp-recipe-form-actions"><button type="button" className="lp-button lp-secondary" onClick={closeForm}>Cancelar</button><button type="submit" className="lp-button lp-primary" disabled={saving}><Save size={16}/>{saving?"Guardando…":"Guardar menú"}</button></div>
        </form>}
        {loading ? <div className="lp-week-empty">Cargando menús…</div> : menus.length === 0 ? <section className="lp-card lp-menu-empty"><Utensils size={30}/><h2>Todavía no hay menús</h2><p>{isAdmin?"Crea el primero con recetas que ya existen en el recetario.":"Cuando se publique un menú, aparecerá aquí."}</p>{isAdmin && <button className="lp-button lp-primary" onClick={startNew}><Plus size={16}/> Crear primer menú</button>}</section> : <section className="lp-menu-grid">{menus.map(menu=>{const items=[...(menu.menu_items||[])].sort((a,b)=>a.sort_order-b.sort_order);return <article className="lp-card lp-menu-card" key={menu.id}><div className="lp-menu-card-top"><span className={`lp-recipe-status ${menu.status}`}>{menu.status==="published"?"Publicado":"Borrador"}</span>{menu.theme_label && <span className="lp-menu-theme">{menu.theme_label}</span>}</div><h2>{menu.title}</h2><p>{menu.description || "Sin descripción"}</p><div className="lp-menu-course-list">{items.map((item,index)=><div key={item.id || item.recipe_id} className="lp-menu-course"><span>{item.course}</span><strong>{item.recipes?.title || item.recipe?.title || "Receta no disponible"}</strong></div>)}</div><div className="lp-menu-card-footer"><span>{items.length} {items.length===1?"receta":"recetas"} · {dateLabel(menu.created_at)}</span>{isAdmin && <div><button type="button" className="lp-button lp-secondary" onClick={()=>startEdit(menu)}><Edit3 size={14}/> Editar</button><button type="button" className="lp-icon-button" onClick={()=>void deleteMenu(menu)} aria-label={`Eliminar menú ${menu.title}`}><Trash2 size={15}/></button></div>}</div></article>})}</section>}
        <footer className="lp-footer">La Partida - Gestión de Cocina</footer>
      </div>
    </main>
  );
}
