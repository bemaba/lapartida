export type ModuleId = "fichaje" | "recetas" | "eventos" | "equipo" | "compras";

export type AppModule = {
  id: ModuleId;
  label: string;
  description: string;
  icon: "clock" | "book" | "calendar" | "users" | "package";
  enabled: boolean;
};

export const appModules: AppModule[] = [
  {
    id: "fichaje",
    label: "Fichaje",
    description: "Entradas, salidas, pausas e histórico horario.",
    icon: "clock",
    enabled: true,
  },
  {
    id: "recetas",
    label: "Recetas",
    description: "Recetario, ingredientes, cantidades y alérgenos.",
    icon: "book",
    enabled: true,
  },
  {
    id: "eventos",
    label: "Eventos",
    description: "Servicios, menús, tareas y planificación.",
    icon: "calendar",
    enabled: false,
  },
  {
    id: "equipo",
    label: "Equipo y turnos",
    description: "Personal, disponibilidad y planificación de turnos.",
    icon: "users",
    enabled: false,
  },
  {
    id: "compras",
    label: "Compras y stock",
    description: "Productos, proveedores e inventario.",
    icon: "package",
    enabled: false,
  },
];
