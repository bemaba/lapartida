"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarDays, Clock3, LockKeyhole, Package, UsersRound, Utensils, Menu, X } from "lucide-react";
import { appModules, type ModuleId } from "@/lib/modules";

const icons = { clock: Clock3, book: BookOpen, utensils: Utensils, calendar: CalendarDays, users: UsersRound, package: Package };

type ModuleNavigationProps = { activeModule?: ModuleId };

export default function ModuleNavigation({ activeModule = "fichaje" }: ModuleNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className={`lp-module-nav-shell ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="lp-module-nav-mobile-head">
        <Link href="/" className="lp-module-nav-mobile-title" onClick={() => setMobileOpen(false)} aria-label="La Partida — ir al fichaje">La Partida</Link>
        <button type="button" className="lp-module-menu-toggle" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <nav className="lp-module-nav" aria-label="Módulos de La Partida">
        {appModules.map((module) => {
          const Icon = icons[module.icon];
          const active = module.id === activeModule;
          const href = module.id === "recetas" ? "/recetas" : module.id === "menus" ? "/menus" : "/";
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
          return <Link key={module.id} href={href} onClick={() => setMobileOpen(false)} className={`lp-module-item ${active ? "active" : ""}`} title={module.description} aria-current={active ? "page" : undefined}>{contents}</Link>;
        })}
      </nav>
    </div>
  );
}
