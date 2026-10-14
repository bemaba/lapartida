export type ModuleId = "fichaje" | "recetas" | "menus" | "eventos" | "equipo" | "compras";

export type AppModule = {
  id: ModuleId;
  label: string;
  description: string;
  icon: "clock" | "book" | "utensils" | "calendar" | "users" | "package";
  enabled: boolean;
};

export const appModules: AppModule[] = [
  { id: "fichaje", label: "Fichaje", description: "Entradas, salidas, pausas e histórico horario.", icon: "clock", enabled: false },
  { id: "recetas", label: "Recetas", description: "Recetario, ingredientes, cantidades y alérgenos.", icon: "book", enabled: true },
  { id: "menus", label: "Menús", description: "Compón menús con recetas existentes, organizadas por pases.", icon: "utensils", enabled: true },
  { id: "eventos", label: "Producción y eventos", description: "Planifica servicios, elaboraciones y tareas por día.", icon: "calendar", enabled: true },
  { id: "equipo", label: "Equipo", description: "Invita empleados y gestiona las cuentas del equipo.", icon: "users", enabled: true },
  { id: "compras", label: "Compras y stock", description: "Productos, proveedores e inventario.", icon: "package", enabled: false },
];
