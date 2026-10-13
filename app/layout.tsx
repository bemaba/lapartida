import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Partida | Gestión de cocina",
  description: "Portal modular para equipos de cocina: fichaje, recetas, menús, eventos, turnos y stock.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}