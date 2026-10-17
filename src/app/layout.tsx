import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RitmoPro | Seguimiento de hábitos",
  description: "Organiza tus hábitos y sigue tu constancia semanal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}