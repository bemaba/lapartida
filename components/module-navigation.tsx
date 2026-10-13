"use client";

import Link from "next/link";
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
      {appModules.map((module) => {
        const Icon = icons[module.icon];
        const active = module.id === activeModule;
        const href = module.id === "recetas" ? "/recetas" : "/";
        const contents = (
          <>
            <Icon size={17} aria-hidden="true" />
            <span>{module.label}</span>
            {!module.enabled && <LockKeyhole size={13} className="lp-module-lock" aria-label="Próximamente" />}
            {active && <span className="lp-module-current">Activo</span>}
          </>
        );
        if (!module.enabled) {
          return <div key={module.id} className="lp-module-item coming-soon" title={`${module.description} Próximamente.`} aria-disabled="true">{contents}</div>;
        }
        return <Link key={module.id} href={href} className={`lp-module-item ${active ? "active" : ""}`} title={module.description} aria-current={active ? "page" : undefined}>{contents}</Link>;
      })}
    </nav>
  );
}
