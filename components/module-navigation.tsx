"use client";

import { BookOpen, CalendarDays, Clock3, LockKeyhole, Package, UsersRound } from "lucide-react";
import { appModules, type ModuleId } from "@/lib/modules";

const icons = {
  clock: Clock3,
  book: BookOpen,
  calendar: CalendarDays,
  users: UsersRound,
  package: Package,
};

type ModuleNavigationProps = {
  activeModule?: ModuleId;
};

export default function ModuleNavigation({ activeModule = "fichaje" }: ModuleNavigationProps) {
  return (
    <nav className="lp-module-nav" aria-label="Módulos de La Partida">
      <div className="lp-module-nav-label">MÓDULOS</div>
      {appModules.map((module) => {
        const Icon = icons[module.icon];
        const active = module.id === activeModule;
        return (
          <div
            key={module.id}
            className={`lp-module-item ${active ? "active" : ""} ${!module.enabled ? "coming-soon" : ""}`}
            title={module.enabled ? module.description : `${module.description} Próximamente.`}
            aria-current={active ? "page" : undefined}
            aria-disabled={!module.enabled}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{module.label}</span>
            {!module.enabled && <LockKeyhole size={13} className="lp-module-lock" aria-label="Próximamente" />}
            {active && <span className="lp-module-current">Activo</span>}
          </div>
        );
      })}
      <p className="lp-module-hint">Iremos activando nuevos módulos sin cambiar el sistema de fichaje.</p>
    </nav>
  );
}
