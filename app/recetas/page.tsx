"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, Session } from "@supabase/supabase-js";
import {
  BookOpen, ChefHat, Clock3, Plus, Search, Users, Eye, Image as ImageIcon,
  Pencil, Trash2, CheckCircle2, Archive, X, Save, Maximize2, SlidersHorizontal, ClipboardList, Upload, Printer
} from "lucide-react";
import ModuleNavigation from "@/components/module-navigation";
import AppHeader from "@/components/app-header";

type Ingredient = { name: string; quantity: string; note: string; recipe_id?: string | null };
type RecipeStep = { instruction: string; minutes: string; temperature: string };
type Recipe = {
  id: string;
  title: string;
  description: string;
  photo_url: string | null;
  cuisine_type: string;
  category: string;
  recipe_type: "final" | "intermediate";
  yield_quantity: number | null;
  yield_unit: string;
  tags: string[];
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: "Fácil" | "Media" | "Alta";
  ingredients: Ingredient[];
  steps: RecipeStep[];
  allergens: string[];
  dietary_tags: string[];
  storage_notes: string;
  status: "draft" | "published" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const categories = ["Entrante", "Principal", "Postre", "Aperitivo", "Guarnición", "Salsa", "Base", "Panadería", "Otro"];
const finalCategories = ["Entrante", "Principal", "Postre", "Aperitivo", "Guarnición", "Otro"];
const intermediateCategories = ["Salsa", "Base", "Guarnición", "Panadería", "Preparación", "Otro"];
const cuisines = ["Mediterránea", "Catalana", "Española", "Italiana", "Asiática", "Latinoamericana", "Francesa", "Fusión", "Otra"];
const allergenOptions = ["Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Leche", "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos"];
const dietaryOptions = ["Vegetariana", "Vegana", "Sin gluten", "Sin lactosa"];
const emptyIngredient = (): Ingredient => ({ name: "", quantity: "", note: "" });
const emptyStep = (): RecipeStep => ({ instruction: "", minutes: "", temperature: "" });
const initialForm = () => ({
  title: "", description: "", photo_url: "", cuisine_type: "Mediterránea", cuisineOtherText: "", category: "Principal",
  recipe_type: "final" as "final" | "intermediate", yield_quantity: "", yield_unit: "g",
  tagsText: "", servings: "10", prep_minutes: "", cook_minutes: "", difficulty: "Media" as "Fácil" | "Media" | "Alta",
  ingredients: [emptyIngredient()], steps: [emptyStep()], allergens: [] as string[], allergenCustomText: "",
  dietary_tags: [] as string[], dietaryCustomText: "", storage_notes: ""
});

type PrintRecipe = { recipe: Recipe; quantityFactor: number };

function extractLeadingQuantity(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?\s*(?:kg|mg|g|gr|gramos?|l|ml|cl|dl|unidades?|uds?))\s+(.+)$/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}
function normalizeUnit(unit: string) {
  const value = unit.trim().toLocaleLowerCase("es").replace(/\./g, "");
  const aliases: Record<string, string> = { gr: "g", gramo: "g", gramos: "g", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg", miligramo: "mg", miligramos: "mg", mililitro: "ml", mililitros: "ml", litro: "l", litros: "l", centilitro: "cl", centilitros: "cl", decilitro: "dl", decilitros: "dl", unidad: "ud", unidades: "ud", uds: "ud", u: "ud", pieza: "ud", piezas: "ud", raciones: "racion", pax: "pax" };
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
function scaleQuantity(quantity: string, factor: number) {
  const parsed = parseQuantityUnit(quantity);
  if (!parsed || !Number.isFinite(factor) || factor <= 0) return quantity;
  const formatted = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(parsed.amount * factor);
  return parsed.unit ? `${formatted} ${parsed.unit}` : formatted;
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
function collectIntermediateRecipes(recipe: Recipe, recipes: Recipe[], rootFactor = 1): PrintRecipe[] {
  const result: PrintRecipe[] = [];
  const seen = new Set<string>();
  const visit = (parent: Recipe, parentFactor: number) => {
    for (const ingredient of parent.ingredients || []) {
      if (!ingredient.recipe_id || seen.has(ingredient.recipe_id)) continue;
      const linked = recipes.find(item => item.id === ingredient.recipe_id && item.recipe_type === "intermediate");
      if (!linked) continue;
      seen.add(linked.id);
      const quantityFactor = intermediateFactor(parent, linked, parentFactor);
      result.push({ recipe: linked, quantityFactor });
      visit(linked, quantityFactor);
    }
  };
  visit(recipe, rootFactor);
  return result;
}
function wouldCreateCycle(parentId: string | null, candidateId: string, recipes: Recipe[]) {
  if (!parentId) return false;
  if (parentId === candidateId) return true;
  const visited = new Set<string>();
  const reachesParent = (id: string): boolean => {
    if (id === parentId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const recipe = recipes.find(item => item.id === id);
    return Boolean(recipe?.ingredients?.some(item => item.recipe_id && reachesParent(item.recipe_id)));
  };
  return reachesParent(candidateId);
}

function PrintableRecipeSection({ recipe, quantityFactor = 1 }: { recipe: Recipe; quantityFactor?: number }) {
  return <section className="lp-recipe-print-section">
    <div className="lp-card-title"><div><span className="lp-kicker">{recipe.recipe_type === "intermediate" ? "ELABORACIÓN INTERMEDIA" : "PLATO FINAL"}</span><h2>{recipe.title}</h2><p>{recipe.cuisine_type} · {recipe.category} · {recipe.recipe_type === "intermediate" ? `Rendimiento: ${recipe.yield_quantity == null ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(recipe.yield_quantity * quantityFactor)} ${recipe.yield_unit || ""}` : `${recipe.servings} pax`}</p></div></div>
    {recipe.description && <p>{recipe.description}</p>}
    <div className="lp-recipe-detail-meta"><span><strong>Preparación:</strong> {recipe.prep_minutes ?? "—"} min</span><span><strong>Cocción:</strong> {recipe.cook_minutes ?? "—"} min</span><span><strong>Dificultad:</strong> {recipe.difficulty}</span>{recipe.recipe_type === "intermediate" && <span><strong>Rendimiento:</strong> {recipe.yield_quantity == null ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(recipe.yield_quantity * quantityFactor)} {recipe.yield_unit}</span>}</div>
    <h3>Ingredientes</h3>
    <ul className="lp-recipe-ingredient-detail">{(recipe.ingredients || []).map((item,index)=><li key={index}><strong>{item.quantity ? scaleQuantity(item.quantity, quantityFactor) : "Cantidad no indicada"}</strong> {item.name}{item.note ? <span> — {item.note}</span> : null}</li>)}</ul>
    <h3>Elaboración</h3>
    <ol className="lp-recipe-step-detail">{(recipe.steps || []).map((step,index)=><li key={index}><p>{step.instruction}</p>{(step.minutes || step.temperature) && <small>{step.minutes ? step.minutes+" min" : ""}{step.minutes && step.temperature ? " · " : ""}{step.temperature}</small>}</li>)}</ol>
    {recipe.allergens?.length > 0 && <><h3>Alérgenos declarados</h3><p>{recipe.allergens.join(", ")}</p></>}
    {recipe.dietary_tags?.length > 0 && <><h3>Características</h3><p>{recipe.dietary_tags.join(", ")}</p></>}
    {recipe.tags?.length > 0 && <><h3>Etiquetas</h3><p>{recipe.tags.join(", ")}</p></>}
    {recipe.storage_notes && <><h3>Conservación y servicio</h3><p>{recipe.storage_notes}</p></>}
  </section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(value));
}
function formatMinutes(prep: number | null, cook: number | null) {
  const total = (prep || 0) + (cook || 0);
  if (!prep && !cook) return "Tiempo no indicado";
  return total ? `${total} min en total` : "Sin tiempo de elaboración";
}
function toForm(recipe: Recipe) {
  return {
    title: recipe.title, description: recipe.description || "", photo_url: recipe.photo_url || "",
    cuisine_type: cuisines.includes(recipe.cuisine_type || "") ? (recipe.cuisine_type || "Otra") : "Otra",
    cuisineOtherText: recipe.cuisine_type && !cuisines.includes(recipe.cuisine_type) ? recipe.cuisine_type : "", category: recipe.category || "Principal",
    recipe_type: recipe.recipe_type || "final", yield_quantity: recipe.yield_quantity == null ? "" : String(recipe.yield_quantity), yield_unit: recipe.yield_unit || "g",
    tagsText: (recipe.tags || []).join(", "), servings: String(recipe.servings || 10),
    prep_minutes: recipe.prep_minutes == null ? "" : String(recipe.prep_minutes),
    cook_minutes: recipe.cook_minutes == null ? "" : String(recipe.cook_minutes),
    difficulty: recipe.difficulty || "Media", ingredients: recipe.ingredients?.length ? recipe.ingredients : [emptyIngredient()],
    steps: recipe.steps?.length ? recipe.steps : [emptyStep()], allergens: recipe.allergens || [],
    dietary_tags: recipe.dietary_tags || [], dietaryCustomText: "", allergenCustomText: "", storage_notes: recipe.storage_notes || ""
  };
}

export default function RecipesPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ user_id: string; full_name: string; role: "admin" | "employee"; active: boolean } | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [recipeView, setRecipeView] = useState<"final" | "intermediate">("final");
  const [statusFilter, setStatusFilter] = useState("available");
  const [pageSize, setPageSize] = useState(9);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [recipeHistory, setRecipeHistory] = useState<Recipe[]>([]);
  const [targetServings, setTargetServings] = useState(10);
  const [targetYieldQuantity, setTargetYieldQuantity] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(false);

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(null); return; }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  useEffect(() => {
    if (!expandedPhoto) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedPhoto(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedPhoto]);

  const isAdmin = profile?.role === "admin";

  const importRecipesFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase || !session || !isAdmin || !profile?.active) {
      event.target.value = "";
      return;
    }
    setImporting(true);
    setNotice("");
    let inserted = 0;
    let skipped = 0;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length > 500) {
        throw new Error("El archivo debe contener una lista JSON de hasta 500 recetas.");
      }
      const { data: existingRows, error: existingError } = await supabase.from("recipes").select("title");
      if (existingError) throw new Error("No se pudieron comprobar las recetas existentes: " + existingError.message);
      const seen = new Set((existingRows || []).map(row => String(row.title || "").trim().toLocaleLowerCase("es")));
      const payload = [];
      for (const value of parsed) {
        if (!value || typeof value !== "object" || typeof value.title !== "string" || !value.title.trim()) {
          skipped++;
          continue;
        }
        const title = value.title.trim();
        const normalizedTitle = title.toLocaleLowerCase("es");
        if (seen.has(normalizedTitle)) {
          skipped++;
          continue;
        }
        seen.add(normalizedTitle);
        const ingredients = Array.isArray(value.ingredients) ? value.ingredients.filter((item: any) => item && typeof item.name === "string") : [];
        const steps = Array.isArray(value.steps) ? value.steps.filter((item: any) => item && typeof item.instruction === "string") : [];
        payload.push({
          title: title.slice(0, 160),
          description: typeof value.description === "string" ? value.description : "",
          cuisine_type: typeof value.cuisine_type === "string" ? value.cuisine_type : "Otra",
          category: typeof value.category === "string" ? value.category : "Otro",
          recipe_type: value.recipe_type === "intermediate" ? "intermediate" : "final",
          yield_quantity: Number.isFinite(Number(value.yield_quantity)) && Number(value.yield_quantity) > 0 ? Number(value.yield_quantity) : null,
          yield_unit: typeof value.yield_unit === "string" && value.yield_unit.trim() ? value.yield_unit.trim() : "g",
          tags: Array.isArray(value.tags) ? value.tags.filter((tag: unknown) => typeof tag === "string") : ["Importado"],
          servings: Number.isInteger(value.servings) && value.servings > 0 && value.servings <= 100000 ? value.servings : 10,
          prep_minutes: Number.isInteger(value.prep_minutes) && value.prep_minutes >= 0 ? value.prep_minutes : null,
          cook_minutes: Number.isInteger(value.cook_minutes) && value.cook_minutes >= 0 ? value.cook_minutes : null,
          difficulty: ["Fácil", "Media", "Alta"].includes(value.difficulty) ? value.difficulty : "Media",
          ingredients,
          steps,
          allergens: Array.isArray(value.allergens) ? value.allergens.filter((item: unknown) => typeof item === "string") : [],
          dietary_tags: Array.isArray(value.dietary_tags) ? value.dietary_tags.filter((item: unknown) => typeof item === "string") : [],
          storage_notes: typeof value.storage_notes === "string" ? value.storage_notes : "",
          status: "draft",
          created_by: session.user.id
        });
      }
      for (let i = 0; i < payload.length; i += 20) {
        const { error } = await supabase.from("recipes").insert(payload.slice(i, i + 20));
        if (error) throw new Error("Importación detenida tras " + inserted + " recetas: " + error.message);
        inserted += payload.slice(i, i + 20).length;
      }
      setNotice("Importación terminada: " + inserted + " recetas creadas como borrador; " + skipped + " duplicados o filas no válidas omitidos.");
      await loadRecipes();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo importar el archivo JSON.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const loadRecipes = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    const { data, error } = await supabase.from("recipes").select("*").order("updated_at", { ascending: false });
    if (error) setNotice("No se pudieron cargar las recetas. Comprueba que has ejecutado el SQL del módulo: " + error.message);
    else setRecipes((data || []) as Recipe[]);
    setLoading(false);
  }, [session]);

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
      if (!next) setLoading(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session) { setProfile(null); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,full_name,role,active").eq("user_id", session.user.id).maybeSingle();
      if (!alive) return;
      if (error || !data) {
        setNotice("No se pudo cargar tu perfil. Comprueba tu cuenta en La Partida.");
        setLoading(false);
        return;
      }
      setProfile(data as { user_id: string; full_name: string; role: "admin" | "employee"; active: boolean });
    })();
    return () => { alive = false; };
  }, [session]);

  useEffect(() => { if (session && profile) void loadRecipes(); }, [session, profile, loadRecipes]);

  const filteredRecipes = useMemo(() => recipes.filter(recipe => {
    if ((recipe.recipe_type || "final") !== recipeView) return false;
    const text = `${recipe.title} ${recipe.description} ${recipe.ingredients?.map(item => item.name).join(" ")} ${(recipe.tags || []).join(" ")}`.toLocaleLowerCase("es");
    const matchesQuery = text.includes(query.trim().toLocaleLowerCase("es"));
    const matchesCategory = categoryFilter === "Todas" || recipe.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "available" ? recipe.status !== "archived" : recipe.status === statusFilter);
    return matchesQuery && matchesCategory && matchesStatus;
  }), [recipes, query, categoryFilter, statusFilter, recipeView]);

  const pageCount = Math.max(1, Math.ceil(filteredRecipes.length / pageSize));
  const paginatedRecipes = useMemo(
    () => filteredRecipes.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRecipes, currentPage, pageSize]
  );
  const firstVisibleRecipe = filteredRecipes.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleRecipe = Math.min(currentPage * pageSize, filteredRecipes.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, categoryFilter, statusFilter, pageSize]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  const openLinkedRecipe = (recipe: Recipe) => {
    if (!selected) return;
    setRecipeHistory(history => [...history, selected]);
    setTargetServings(recipe.servings);
    setTargetYieldQuantity(recipe.yield_quantity || 1);
    setSelected(recipe);
  };
  const returnToPreviousRecipe = () => {
    const previous = recipeHistory[recipeHistory.length - 1];
    if (!previous) return;
    setRecipeHistory(history => history.slice(0, -1));
    setTargetServings(previous.servings);
    setTargetYieldQuantity(previous.yield_quantity || 1);
    setSelected(previous);
  };

  const startNew = (type: "final" | "intermediate" = "final") => {
    setEditing(null); setForm({ ...initialForm(), recipe_type: type }); setRecipeView(type); setPhotoFile(null); setRemovePhoto(false); setFormOpen(true); setSelected(null); setRecipeHistory([]); setNotice("");
  };
  const startEdit = (recipe: Recipe) => {
    const type = recipe.recipe_type || "final";
    setEditing(recipe); setForm(toForm(recipe)); setRecipeView(type); setPhotoFile(null); setRemovePhoto(false); setFormOpen(true); setSelected(null); setRecipeHistory([]); setNotice("");
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(initialForm()); setPhotoFile(null); setRemovePhoto(false); };

  const saveRecipe = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !session || !profile?.active) return;
    if (form.ingredients.filter(item => item.name.trim()).length === 0) {
      setNotice("Añade al menos un ingrediente.");
      return;
    }
        if (form.recipe_type === "intermediate" && (!form.yield_quantity.trim() || !Number.isFinite(Number(form.yield_quantity)) || Number(form.yield_quantity) <= 0 || !form.yield_unit.trim())) {
      setNotice("Indica un rendimiento obtenido mayor que cero y su unidad para la elaboración intermedia.");
      return;
    }
    if (form.recipe_type === "final" && editing && recipes.some(parent => parent.id !== editing.id && parent.ingredients?.some(item => item.recipe_id === editing.id))) {
      setNotice("Esta receta está vinculada como elaboración de otro plato. Desvincúlala primero antes de cambiarla a plato final.");
      return;
    }
    for (const item of form.ingredients.filter(ingredient => ingredient.recipe_id)) {
      const linked = recipes.find(recipe => recipe.id === item.recipe_id);
      if (!linked || linked.recipe_type !== "intermediate" || linked.status === "archived") {
        setNotice("Cada elaboración vinculada debe existir, estar activa y ser de tipo intermedio.");
        return;
      }
      if (wouldCreateCycle(editing?.id || null, linked.id, recipes)) {
        setNotice("Esta relación crearía un ciclo entre recetas. Elige otra elaboración.");
        return;
      }
    }
    setSaving(true); setNotice("");
    let photoUrl = removePhoto ? null : form.photo_url.trim() || null;
    if (photoFile) {
      const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const extension = extensions[photoFile.type];
      if (!extension || photoFile.size > 5 * 1024 * 1024) {
        setNotice("La foto debe ser JPG, PNG o WebP y ocupar como máximo 5 MB.");
        setSaving(false);
        return;
      }
      const storagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("recipe-photos").upload(storagePath, photoFile, {
        contentType: photoFile.type,
        cacheControl: "3600",
        upsert: false
      });
      if (uploadError) {
        setNotice("No se pudo subir la fotografía: " + uploadError.message);
        setSaving(false);
        return;
      }
      photoUrl = supabase.storage.from("recipe-photos").getPublicUrl(storagePath).data.publicUrl;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      photo_url: photoUrl,
      cuisine_type: form.cuisine_type === "Otra" && form.cuisineOtherText.trim() ? form.cuisineOtherText.trim() : form.cuisine_type,
      category: form.category,
      recipe_type: form.recipe_type,
      yield_quantity: form.recipe_type === "intermediate" ? Number(form.yield_quantity) : null,
      yield_unit: form.yield_unit.trim() || "g",
      tags: form.tagsText.split(",").map(tag => tag.trim()).filter(Boolean),
      servings: Math.max(1, Number(form.servings) || 1),
      prep_minutes: form.prep_minutes === "" ? null : Math.max(0, Number(form.prep_minutes) || 0),
      cook_minutes: form.cook_minutes === "" ? null : Math.max(0, Number(form.cook_minutes) || 0),
      difficulty: form.difficulty,
      ingredients: form.ingredients.filter(item => item.name.trim()).map(item => ({ name: item.name.trim(), quantity: item.quantity.trim() || extractLeadingQuantity(item.name), note: item.note.trim(), recipe_id: item.recipe_id || null })),
      steps: form.steps.filter(item => item.instruction.trim()).map(item => ({ instruction: item.instruction.trim(), minutes: item.minutes.trim(), temperature: item.temperature.trim() })),
      allergens: form.allergens,
      dietary_tags: form.dietary_tags,
      storage_notes: form.storage_notes.trim(),
      ...(editing && isAdmin ? {} : {})
    };
    const result = editing
      ? await supabase.from("recipes").update(payload).eq("id", editing.id)
      : await supabase.from("recipes").insert({ ...payload, created_by: session.user.id, status: "draft" });
    if (result.error) {
      setNotice("No se pudo guardar la receta: " + result.error.message);
    } else {
      setNotice(editing ? "Receta actualizada." : "Receta guardada como borrador. Un administrador debe revisarla antes de publicarla.");
      closeForm();
      await loadRecipes();
    }
    setSaving(false);
  };

  const adminUpdateStatus = async (recipe: Recipe, status: "published" | "archived" | "draft") => {
    if (!supabase || !isAdmin) return;
    if (status === "published") {
      const unpublished = collectIntermediateRecipes(recipe, recipes).filter(item => item.recipe.status !== "published");
      if (unpublished.length) {
        setNotice("Antes de publicar esta ficha, publica sus elaboraciones intermedias: " + Array.from(new Set(unpublished.map(item => item.recipe.title))).join(", "));
        return;
      }
    }
    const payload: Record<string, unknown> = { status };
    if (status === "published") {
      payload.published_by = session?.user.id;
      payload.published_at = new Date().toISOString();
    }
    const { error } = await supabase.from("recipes").update(payload).eq("id", recipe.id);
    if (error) setNotice("No se pudo actualizar la receta: " + error.message);
    else {
      setNotice(status === "published" ? "Receta publicada para todo el equipo." : status === "archived" ? "Receta archivada." : "Receta devuelta a borrador.");
      setSelected(null);
      await loadRecipes();
    }
  };

  const deleteRecipe = async (recipe: Recipe) => {
    if (!supabase || !isAdmin) return;
    if (!window.confirm(`¿Eliminar definitivamente la receta «${recipe.title}»? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) setNotice("No se pudo eliminar la receta: " + error.message);
    else { setNotice("Receta eliminada."); setSelected(null); await loadRecipes(); }
  };

  const toggleArrayValue = (key: "allergens" | "dietary_tags", value: string) => {
    setForm(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  };
  const addCustomArrayValue = (key: "allergens" | "dietary_tags", inputKey: "allergenCustomText" | "dietaryCustomText") => {
    const value = form[inputKey].trim();
    if (!value) return;
    if (form[key].some(item => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"))) {
      setNotice("Esa opción ya está añadida.");
      return;
    }
    setForm(current => ({ ...current, [key]: [...current[key], value], [inputKey]: "" }));
    setNotice("");
  };

  if (!supabase) return <main className="lp-center"><section className="lp-card lp-config"><ChefHat size={26}/><h1>La Partida</h1><p>Falta configurar la conexión con Supabase.</p></section></main>;
  if (!session) return <main className="lp-center"><section className="lp-card lp-config"><BookOpen size={28}/><h1>Recetario</h1><p>Inicia sesión en La Partida para consultar las recetas.</p><Link className="lp-button lp-primary" href="/">Ir al inicio de sesión</Link></section></main>;
  if (profile && !profile.active) return <main className="lp-center"><section className="lp-card lp-config"><h1>Cuenta desactivada</h1><p>Contacta con una administradora de La Partida.</p><Link href="/">Volver</Link></section></main>;

  return (
    <main className="lp-app">
      <AppHeader fullName={profile?.full_name || session.user.email || "Usuario"} role={profile?.role || "employee"} onLogout={() => void supabase?.auth.signOut()} />
      <ModuleNavigation activeModule="recetas" />
      <div className="lp-content">
        <div className="lp-heading">
          <div><div className="lp-kicker">RECETARIO COMPARTIDO</div><h1>Recetas</h1><p>Separa platos finales y elaboraciones reutilizables, con fichas y cantidades de producción.</p></div>
          <div className="lp-recipe-heading-actions">
            {isAdmin && <label className="lp-button lp-secondary lp-import-recipes-button">
              <Upload size={16}/>{importing ? "Importando…" : "Importar JSON"}
              <input type="file" accept=".json,application/json" disabled={importing} onChange={importRecipesFile} />
            </label>}
            <button className="lp-button lp-primary" onClick={() => startNew("final")}><Plus size={17}/> Nuevo plato final</button><button className="lp-button lp-secondary" onClick={() => startNew("intermediate")}><Plus size={17}/> Nueva elaboración</button>
          </div>
        </div>
        {notice && <div className="lp-notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Cerrar aviso"><X size={16}/></button></div>}

        {formOpen && <section className="lp-card lp-recipe-form-card">
          <div className="lp-card-title"><div><span className="lp-kicker">{editing ? "EDITAR RECETA" : "NUEVA RECETA"}</span><h2>{editing ? editing.title : "Crear una receta"}</h2><p className="lp-muted small-text">{editing ? "Los cambios se guardan en la receta actual." : "Se guardará como borrador hasta que un administrador la revise."}</p></div><button type="button" className="lp-icon-button" onClick={closeForm} aria-label="Cerrar formulario"><X size={17}/></button></div>
          <form className="lp-recipe-form" onSubmit={saveRecipe}>
            <div className="lp-recipe-section-title"><BookOpen size={17}/><h3>Información general</h3></div>
            <div className="lp-recipe-grid">
              <label className="wide">Nombre de la receta *<input required minLength={2} maxLength={160} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Ej. Croquetas de setas"/></label>
              <label className="wide">Descripción<textarea rows={2} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Describe el plato y qué lo hace especial"/></label>
              <div className="lp-recipe-custom-field"><label>Tipo de cocina<select value={form.cuisine_type} onChange={e => setForm({...form,cuisine_type:e.target.value,cuisineOtherText:e.target.value === "Otra" ? form.cuisineOtherText : ""})}>{cuisines.map(item=><option key={item}>{item}</option>)}</select></label>{form.cuisine_type === "Otra" && <label>Especifica el tipo de cocina<input value={form.cuisineOtherText} onChange={e=>setForm({...form,cuisineOtherText:e.target.value})} placeholder="Ej. Peruana, mexicana…"/></label>}</div>
              <label>Tipo de ficha<select value={form.recipe_type} onChange={e => setForm({...form,recipe_type:e.target.value as "final"|"intermediate"})}><option value="final">Plato final</option><option value="intermediate">Elaboración intermedia</option></select></label>
              <label>Categoría<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{Array.from(new Set([...(form.recipe_type === "intermediate" ? intermediateCategories : finalCategories), ...(form.category && !(form.recipe_type === "intermediate" ? intermediateCategories : finalCategories).includes(form.category) ? [form.category] : [])])).map(item=><option key={item}>{item}</option>)}</select></label>
              {form.recipe_type === "intermediate" && <><label>Rendimiento obtenido *<input required type="number" min="0.001" step="any" value={form.yield_quantity} onChange={e => setForm({...form,yield_quantity:e.target.value})} placeholder="Ej. 3"/></label><label>Unidad del rendimiento *<select required value={form.yield_unit} onChange={e => setForm({...form,yield_unit:e.target.value})}><option value="g">g (gramos)</option><option value="kg">kg (kilogramos)</option><option value="ml">ml (mililitros)</option><option value="l">l (litros)</option><option value="ud">unidades</option><option value="racion">raciones</option></select></label></>}
              <label>Raciones (pax) *<input required type="number" min="1" max="100000" value={form.servings} onChange={e => setForm({...form,servings:e.target.value})}/></label>
              <label>Dificultad<select value={form.difficulty} onChange={e => setForm({...form,difficulty:e.target.value as "Fácil"|"Media"|"Alta"})}><option>Fácil</option><option>Media</option><option>Alta</option></select></label>
              <label>Preparación (min)<input type="number" min="0" value={form.prep_minutes} onChange={e => setForm({...form,prep_minutes:e.target.value})} placeholder="Ej. 20"/></label>
              <label>Cocción (min)<input type="number" min="0" value={form.cook_minutes} onChange={e => setForm({...form,cook_minutes:e.target.value})} placeholder="Ej. 45"/></label>
              <div className="wide lp-recipe-photo-upload"><label>Fotografía de la receta (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                  setNotice("Elige una imagen JPG, PNG o WebP de máximo 5 MB.");
                  e.target.value = "";
                  return;
                }
                setNotice(""); setPhotoFile(file); setRemovePhoto(false); setForm(current => ({...current, photo_url: ""}));
              }}/></label>
                {(photoPreview || (!removePhoto && form.photo_url)) && <div className="lp-recipe-photo-upload-preview"><img src={photoPreview || form.photo_url} alt="Vista previa de la receta"/><button type="button" className="lp-button lp-secondary" onClick={() => {setPhotoFile(null);setForm(current=>({...current,photo_url:""}));setRemovePhoto(true);}}>Quitar fotografía</button></div>}
                <p className="lp-muted small-text">Sube una imagen JPG, PNG o WebP (máximo 5 MB). No necesitas pegar ningún enlace.</p>
              </div>
              <label className="wide">Etiquetas (separadas por comas)<input value={form.tagsText} onChange={e => setForm({...form,tagsText:e.target.value})} placeholder="temporada, menú degustación, evento"/></label>
            </div>

            <div className="lp-recipe-section-title"><ClipboardList size={17}/><h3>Ingredientes</h3><span>{form.ingredients.filter(item=>item.name.trim()).length} ingredientes</span></div>
            <div className="lp-ingredient-list">
              {form.ingredients.map((item,index)=><div className="lp-ingredient-row" key={index}>
                <label>Ingrediente<input value={item.name} onChange={e=>setForm(current=>({...current,ingredients:current.ingredients.map((row,i)=>i===index?{...row,name:e.target.value}:row)}))} placeholder="Ej. Harina"/></label>
                <label>Cantidad y unidad<input value={item.quantity} onChange={e=>setForm(current=>({...current,ingredients:current.ingredients.map((row,i)=>i===index?{...row,quantity:e.target.value}:row)}))} placeholder="500 g"/></label>
                <label>Notas<input value={item.note} onChange={e=>setForm(current=>({...current,ingredients:current.ingredients.map((row,i)=>i===index?{...row,note:e.target.value}:row)}))} placeholder="Tamizada, picado…"/></label>
                <label>Elaboración intermedia<select value={item.recipe_id || ""} onChange={e=>{const recipeId=e.target.value || null;const linked=recipes.find(recipe=>recipe.id===recipeId);setForm(current=>({...current,ingredients:current.ingredients.map((row,i)=>i===index?{...row,recipe_id:recipeId,name:linked?.title || row.name}:row)}));}}><option value="">No es una elaboración intermedia</option>{recipes.filter(recipe=>recipe.recipe_type==="intermediate" && recipe.id!==(editing?.id || "") && recipe.status!=="archived" && !wouldCreateCycle(editing?.id || null,recipe.id,recipes)).map(recipe=><option key={recipe.id} value={recipe.id}>{recipe.title}{recipe.status==="draft"?" (borrador)":""}{recipe.yield_quantity ? ` · ${recipe.yield_quantity} ${recipe.yield_unit}` : ""}</option>)}</select></label>
                <button type="button" className="lp-icon-button" onClick={()=>setForm(current=>({...current,ingredients:current.ingredients.filter((_,i)=>i!==index).length?current.ingredients.filter((_,i)=>i!==index):[emptyIngredient()]}))} aria-label="Eliminar ingrediente"><X size={15}/></button>
              </div>)}
              <button type="button" className="lp-button lp-secondary lp-add-row" onClick={()=>setForm(current=>({...current,ingredients:[...current.ingredients,emptyIngredient()]}))}><Plus size={15}/> Añadir ingrediente</button>
            </div>

            <div className="lp-recipe-section-title"><ClipboardList size={17}/><h3>Elaboración paso a paso</h3></div><p className="lp-recipe-form-hint">Si la fuente no incluye pasos, puedes guardar la ficha sin inventarlos. Quedará señalada como pendiente de completar.</p>
            <div className="lp-step-list">
              {form.steps.map((step,index)=><div className="lp-step-row" key={index}>
                <span className="lp-step-number">{index+1}</span>
                <div className="lp-step-fields"><label>Instrucciones *<textarea rows={2} value={step.instruction} onChange={e=>setForm(current=>({...current,steps:current.steps.map((row,i)=>i===index?{...row,instruction:e.target.value}:row)}))} placeholder="Describe qué hay que hacer"/></label><div className="lp-recipe-grid compact"><label>Tiempo (min)<input type="number" min="0" value={step.minutes} onChange={e=>setForm(current=>({...current,steps:current.steps.map((row,i)=>i===index?{...row,minutes:e.target.value}:row)}))}/></label><label>Temperatura (opcional)<input value={step.temperature} onChange={e=>setForm(current=>({...current,steps:current.steps.map((row,i)=>i===index?{...row,temperature:e.target.value}:row)}))} placeholder="180 °C"/></label></div></div>
                <button type="button" className="lp-icon-button" onClick={()=>setForm(current=>({...current,steps:current.steps.filter((_,i)=>i!==index).length?current.steps.filter((_,i)=>i!==index):[emptyStep()]}))} aria-label="Eliminar paso"><X size={15}/></button>
              </div>)}
              <button type="button" className="lp-button lp-secondary lp-add-row" onClick={()=>setForm(current=>({...current,steps:[...current.steps,emptyStep()]}))}><Plus size={15}/> Añadir paso</button>
            </div>

            <div className="lp-recipe-section-title"><SlidersHorizontal size={17}/><h3>Información alimentaria</h3></div>
            <div className="lp-recipe-grid">
              <fieldset className="lp-choice-field"><legend>Alérgenos presentes</legend><div className="lp-check-grid">{allergenOptions.map(item=><label key={item}><input type="checkbox" checked={form.allergens.includes(item)} onChange={()=>toggleArrayValue("allergens",item)}/>{item}</label>)}{form.allergens.filter(item=>!allergenOptions.includes(item)).map(item=><label key={item}><input type="checkbox" checked onChange={()=>toggleArrayValue("allergens",item)}/>{item} <span className="lp-custom-option-label">(personalizado)</span></label>)}</div><div className="lp-recipe-add-custom"><input aria-label="Añadir otro alérgeno" value={form.allergenCustomText} onChange={e=>setForm({...form,allergenCustomText:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCustomArrayValue("allergens","allergenCustomText");}}} placeholder="Añadir otro alérgeno…"/><button type="button" className="lp-button lp-secondary" onClick={()=>addCustomArrayValue("allergens","allergenCustomText")}><Plus size={14}/> Añadir</button></div></fieldset>
              <fieldset className="lp-choice-field"><legend>Características</legend><div className="lp-check-grid">{dietaryOptions.map(item=><label key={item}><input type="checkbox" checked={form.dietary_tags.includes(item)} onChange={()=>toggleArrayValue("dietary_tags",item)}/>{item}</label>)}{form.dietary_tags.filter(item=>!dietaryOptions.includes(item)).map(item=><label key={item}><input type="checkbox" checked onChange={()=>toggleArrayValue("dietary_tags",item)}/>{item} <span className="lp-custom-option-label">(personalizada)</span></label>)}</div><div className="lp-recipe-add-custom"><input aria-label="Añadir otra característica" value={form.dietaryCustomText} onChange={e=>setForm({...form,dietaryCustomText:e.target.value})} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCustomArrayValue("dietary_tags","dietaryCustomText");}}} placeholder="Añadir otra característica…"/><button type="button" className="lp-button lp-secondary" onClick={()=>addCustomArrayValue("dietary_tags","dietaryCustomText")}><Plus size={14}/> Añadir</button></div></fieldset>
              <label className="wide">Conservación, congelación y servicio<textarea rows={3} value={form.storage_notes} onChange={e=>setForm({...form,storage_notes:e.target.value})} placeholder="Condiciones de conservación, regeneración, emplatado…"/></label>
            </div>
            <div className="lp-recipe-form-actions"><button type="button" className="lp-button lp-secondary" onClick={closeForm}>Cancelar</button><button type="submit" className="lp-button lp-primary" disabled={saving}><Save size={16}/>{saving?"Guardando…":"Guardar borrador"}</button></div>
          </form>
        </section>}

        <section className="lp-card lp-recipe-library">
          <div className="lp-recipe-type-tabs" role="tablist" aria-label="Tipo de receta"><button type="button" role="tab" aria-selected={recipeView==="final"} className={recipeView==="final"?"active":""} onClick={()=>setRecipeView("final")}>Platos finales <span>{recipes.filter(recipe=>(recipe.recipe_type||"final")==="final" && recipe.status!=="archived").length}</span></button><button type="button" role="tab" aria-selected={recipeView==="intermediate"} className={recipeView==="intermediate"?"active":""} onClick={()=>setRecipeView("intermediate")}>Elaboraciones intermedias <span>{recipes.filter(recipe=>recipe.recipe_type==="intermediate" && recipe.status!=="archived").length}</span></button></div>
          <div className="lp-recipe-filters">
            <label className="lp-recipe-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar receta o ingrediente…"/></label>
            <select aria-label="Filtrar por categoría" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option>Todas</option>{categories.map(item=><option key={item}>{item}</option>)}</select>
            <select aria-label="Filtrar por estado" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="available">Activas</option><option value="all">Todos los estados</option><option value="published">Publicadas</option><option value="draft">Borradores</option><option value="archived">Archivadas</option></select>
          </div>
          {loading ? <div className="lp-week-empty">Cargando recetas…</div> : filteredRecipes.length === 0 ? <div className="lp-week-empty"><BookOpen size={28}/><strong>No hay recetas para mostrar</strong><span>{recipes.length ? "Prueba a cambiar los filtros." : "Crea la primera receta para empezar el recetario compartido."}</span>{!recipes.length && <button className="lp-button lp-primary" onClick={() => startNew()}><Plus size={16}/> Crear primera receta</button>}</div> :
            <div className="lp-recipe-grid-cards">{paginatedRecipes.map(recipe=><article className="lp-recipe-card" key={recipe.id}>
              {recipe.photo_url ? <img className="lp-recipe-photo" src={recipe.photo_url} alt={recipe.title} loading="lazy"/> : <div className="lp-recipe-photo lp-recipe-photo-empty"><ImageIcon size={30}/><span>Sin fotografía</span></div>}
              <div className="lp-recipe-card-body">
                <div className="lp-recipe-card-top"><span className="lp-recipe-category">{recipe.category}</span><span className={`lp-recipe-status ${recipe.status}`}>{recipe.status==="published"?"Publicada":recipe.status==="draft"?"Borrador":"Archivada"}</span></div>
                <h3>{recipe.title}</h3><p>{recipe.description || "Sin descripción"}</p>
                <div className="lp-recipe-meta"><span><Users size={14}/>{recipe.servings} pax</span><span><Clock3 size={14}/>{formatMinutes(recipe.prep_minutes,recipe.cook_minutes)}</span></div>
                <div className="lp-recipe-card-footer"><button className="lp-button lp-secondary" onClick={()=>{setRecipeHistory([]);setTargetServings(recipe.servings);setTargetYieldQuantity(recipe.yield_quantity || 1);setSelected(recipe);}}><Eye size={15}/> Ver receta</button>{(isAdmin || (recipe.created_by===session.user.id && recipe.status==="draft")) && <button className="lp-icon-button" title="Editar receta" onClick={()=>startEdit(recipe)}><Pencil size={15}/></button>}</div>
              </div>
            </article>)}</div>}
          {!loading && filteredRecipes.length > 0 && <div className="lp-recipe-pagination">
            <div className="lp-recipe-pagination-summary">Mostrando <strong>{firstVisibleRecipe}–{lastVisibleRecipe}</strong> de <strong>{filteredRecipes.length}</strong> recetas</div>
            <div className="lp-recipe-pagination-controls">
              <label>Por página
                <select aria-label="Recetas por página" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                  <option value={9}>9</option><option value={18}>18</option><option value={27}>27</option><option value={36}>36</option><option value={45}>45</option><option value={90}>90</option>
                </select>
              </label>
              <button type="button" className="lp-button lp-secondary lp-page-button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage <= 1} aria-label="Página anterior">‹ Anterior</button>
              <span className="lp-recipe-page-number">Página {currentPage} de {pageCount}</span>
              <button type="button" className="lp-button lp-secondary lp-page-button" onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))} disabled={currentPage >= pageCount} aria-label="Página siguiente">Siguiente ›</button>
            </div>
          </div>}
        </section>
      </div>

      {selected && <div className="lp-recipe-overlay" role="presentation" onClick={e=>{if(e.target===e.currentTarget){setSelected(null);setRecipeHistory([]);}}}>
        <section className="lp-card lp-recipe-detail" role="dialog" aria-modal="true" aria-labelledby="recipe-detail-title">
          <div className="lp-card-title"><div><span className="lp-kicker">{selected.recipe_type === "intermediate" ? "ELABORACIÓN INTERMEDIA" : "PLATO FINAL"}</span><h2 id="recipe-detail-title">{selected.title}</h2><p className="lp-muted small-text">{selected.cuisine_type} · {selected.category} · {selected.recipe_type === "intermediate" ? `Rendimiento: ${selected.yield_quantity ?? "—"} ${selected.yield_unit || ""}` : `${selected.servings} pax`}</p></div><div className="lp-recipe-nav-actions">{recipeHistory.length>0&&<button type="button" className="lp-button lp-secondary" onClick={returnToPreviousRecipe}>← Volver a receta anterior</button>}<button className="lp-icon-button" onClick={()=>{setSelected(null);setRecipeHistory([]);}} aria-label="Cerrar receta"><X size={17}/></button></div></div>
          {selected.photo_url && <div className="lp-recipe-detail-photo-wrap"><img className="lp-recipe-detail-photo" src={selected.photo_url} alt={selected.title}/><button type="button" className="lp-recipe-detail-photo-expand" onClick={e=>{e.stopPropagation();setExpandedPhoto(true)}} aria-label={`Ampliar fotografía de ${selected.title}`} title="Ampliar fotografía"><Maximize2 size={18}/></button></div>}
          <p>{selected.description || "Sin descripción."}</p>
          <div className="lp-recipe-detail-meta"><span><strong>Preparación:</strong> {selected.prep_minutes ?? "—"} min</span><span><strong>Cocción:</strong> {selected.cook_minutes ?? "—"} min</span><span><strong>Dificultad:</strong> {selected.difficulty}</span>{selected.recipe_type === "intermediate" && <span><strong>Rendimiento:</strong> {selected.yield_quantity ?? "—"} {selected.yield_unit}</span>}</div>
          <div className="lp-recipe-ingredients-heading"><h3>Ingredientes</h3>{selected.recipe_type === "intermediate" ? <label>Cantidad a producir ({selected.yield_unit})<input type="number" min="0.001" step="any" value={targetYieldQuantity} onChange={e=>setTargetYieldQuantity(Math.max(0.001,Number(e.target.value)||0.001))}/></label> : <label>Raciones a preparar<input type="number" min="1" max="100000" value={targetServings} onChange={e=>setTargetServings(Math.max(1,Math.min(100000,Number(e.target.value)||1)))}/></label>}</div><p className="lp-recipe-scale-note">{selected.recipe_type === "intermediate" ? `Cantidades ajustadas desde el rendimiento original de ${selected.yield_quantity ?? "—"} ${selected.yield_unit}.` : `Cantidades ajustadas desde la receta original de ${selected.servings} pax.`}</p><ul className="lp-recipe-ingredient-detail">{selected.ingredients?.map((item,index)=>{const linked=item.recipe_id?recipes.find(recipe=>recipe.id===item.recipe_id):null;return <li key={index}><strong>{item.quantity ? scaleQuantity(item.quantity,selected.recipe_type === "intermediate" ? targetYieldQuantity / Math.max(0.001, selected.yield_quantity || 1) : targetServings / Math.max(1, selected.servings)) : "Cantidad no indicada"}</strong> {item.name}{item.note? <span> — {item.note}</span>:null}{linked&&<button type="button" className="lp-inline-recipe-link" onClick={()=>openLinkedRecipe(linked)}>Ver receta intermedia: {linked.title} ↗</button>}</li>;})}</ul>
          <h3>Elaboración</h3>{selected.steps?.some(step=>step.instruction?.trim()) ? <ol className="lp-recipe-step-detail">{selected.steps.filter(step=>step.instruction?.trim()).map((step,index)=><li key={index}><p>{step.instruction}</p>{(step.minutes||step.temperature)&&<small>{step.minutes?step.minutes+" min":""}{step.minutes&&step.temperature?" · ":""}{step.temperature}</small>}</li>)}</ol> : <p className="lp-recipe-source-warning">La fuente no contiene pasos de elaboración. Pendiente de completar con la receta original; no se han inventado instrucciones.</p>}
          {selected.allergens?.length>0&&<><h3>Alérgenos declarados</h3><div className="lp-recipe-tags">{selected.allergens.map(item=><span key={item}>{item}</span>)}</div></>}
          {selected.dietary_tags?.length>0&&<><h3>Características</h3><div className="lp-recipe-tags">{selected.dietary_tags.map(item=><span key={item}>{item}</span>)}</div></>}
          {selected.tags?.length>0&&<><h3>Etiquetas</h3><div className="lp-recipe-tags">{selected.tags.map(item=><span key={item}>{item}</span>)}</div></>}
          {selected.storage_notes&&<><h3>Conservación y servicio</h3><p className="lp-recipe-storage">{selected.storage_notes}</p></>}
          <div className="lp-recipe-detail-footer">
            <span className={`lp-recipe-status ${selected.status}`}>{selected.status==="published"?"Publicada":selected.status==="draft"?"Borrador pendiente de revisión":"Archivada"}</span>
            <div className="lp-recipe-actions">
              <button type="button" className="lp-button lp-secondary lp-print-recipe" onClick={() => window.print()}><Printer size={15}/>{collectIntermediateRecipes(selected, recipes).length ? " Imprimir receta e intermedias" : " Imprimir receta"}</button>
              {(isAdmin || (selected.created_by===session.user.id && selected.status==="draft"))&&<button className="lp-button lp-secondary" onClick={()=>startEdit(selected)}><Pencil size={15}/> Editar</button>}
              {isAdmin&&selected.status!=="published"&&<button className="lp-button lp-primary" onClick={()=>void adminUpdateStatus(selected,"published")}><CheckCircle2 size={15}/> Publicar</button>}
              {isAdmin&&selected.status!=="archived"&&<button className="lp-button lp-secondary" onClick={()=>void adminUpdateStatus(selected,"archived")}><Archive size={15}/> Archivar</button>}
              {isAdmin&&<button className="lp-button lp-danger" onClick={()=>void deleteRecipe(selected)}><Trash2 size={15}/> Eliminar</button>}
            </div>
          </div>
          <p className="lp-recipe-audit">Creada el {formatDate(selected.created_at)} · Actualizada el {formatDate(selected.updated_at)}</p>
        </section>
      </div>}
      {selected && <div className="lp-recipe-print-bundle" aria-hidden="true"><PrintableRecipeSection recipe={selected} quantityFactor={selected.recipe_type === "intermediate" ? targetYieldQuantity / Math.max(0.001, selected.yield_quantity || 1) : targetServings / Math.max(1, selected.servings)}/>{collectIntermediateRecipes(selected, recipes, selected.recipe_type === "intermediate" ? targetYieldQuantity / Math.max(0.001, selected.yield_quantity || 1) : targetServings / Math.max(1, selected.servings)).map(item=><PrintableRecipeSection key={item.recipe.id} recipe={item.recipe} quantityFactor={item.quantityFactor}/>)}</div>}
      {expandedPhoto && selected?.photo_url && <div className="lp-photo-lightbox" role="dialog" aria-modal="true" aria-label={`Fotografía ampliada de ${selected.title}`} onClick={e=>{if(e.target===e.currentTarget)setExpandedPhoto(false);}}><button type="button" className="lp-photo-lightbox-close" onClick={()=>setExpandedPhoto(false)} aria-label="Cerrar fotografía ampliada"><X size={22}/></button><img src={selected.photo_url} alt={selected.title} onClick={e=>e.stopPropagation()}/><span>Haz clic fuera de la imagen o pulsa × para cerrar</span></div>}
    </main>
  );
}
