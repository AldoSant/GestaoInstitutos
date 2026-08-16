import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Veredas | Gestão de Institutos",
    template: "%s | Veredas",
  },
  description: "Plataforma Veredas para gestão de folha, cadastros e obrigações dos institutos.",
  icons: {
    icon: "/veredas/favicon.png",
    shortcut: "/veredas/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
