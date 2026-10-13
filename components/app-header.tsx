"use client";

import Link from "next/link";
import { ChefHat, KeyRound, LogOut } from "lucide-react";

type AppHeaderProps = {
  fullName: string;
  role: "admin" | "employee";
  onLogout: () => void;
};

export default function AppHeader({ fullName, role, onLogout, onRefresh }: AppHeaderProps) {
  return (
    <header className="lp-topbar lp-app-header">
      <Link href="/" className="lp-brand lp-app-brand" aria-label="La Partida — ir al fichaje">
        <div className="lp-logo small"><ChefHat size={20} /></div>
        <div className="lp-app-brand-copy"><strong>La Partida</strong><span>GESTIÓN DE COCINA</span></div>
      </Link>
      <div className="lp-user lp-app-header-user">
        <span className="lp-app-header-name" title={fullName}>{fullName}</span>
        <span className="lp-user-role">{role === "admin" ? "Administración" : "Equipo"}</span>
        <Link className="lp-icon-button" href="/change-password" title="Cambiar contraseña" aria-label="Cambiar contraseña"><KeyRound size={16}/></Link>
        <button type="button" className="lp-icon-button" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={16}/></button>
      </div>
    </header>
  );
}
