import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Partida | Control horario",
  description: "Fichajes, pausas y planificación de turnos para equipos de cocina.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}