"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  Database,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  Gauge,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";

const navegacao = [
  { href: "/", label: "Visão geral", icon: Gauge },
  { href: "/folhas", label: "Folhas", icon: BadgeDollarSign },
  { href: "/cadastros", label: "Cadastros", icon: Database },
  { href: "/prestadores", label: "Prestadores", icon: UsersRound },
  { href: "/obrigacoes", label: "Obrigações", icon: FileCheck2 },
  { href: "/parametros", label: "Parâmetros", icon: Settings2 },
];

function Logo() {
  return (
    <Link href="/" className="brand" aria-label="Instituto Folha — início">
      <span className="brand-mark"><ShieldCheck size={22} /></span>
      <span><strong>Instituto</strong><small>Folha & Obrigações</small></span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="nav-list" aria-label="Navegação principal">
      {navegacao.map(({ href, label, icon: Icon }) => {
        const ativo = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            href={href}
            key={href}
            className={ativo ? "nav-link active" : "nav-link"}
            onClick={onNavigate}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  title,
  eyebrow,
  actions,
  organization = "Instituto · Demonstração",
  notice = {
    label: "Protótipo local",
    text: "Dados demonstrativos e anonimizados. Nenhuma obrigação fiscal é transmitida.",
  },
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  organization?: string;
  notice?: { label: string; text: string };
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Logo />
        <div className="tenant-card">
          <Building2 size={17} />
          <span><small>Organização ativa</small><strong>{organization}</strong></span>
          <ChevronDown size={15} />
        </div>
        <NavLinks />
        <div className="sidebar-bottom">
          <Link href="/ajuda" className="nav-link"><CircleHelp size={19} /><span>Ajuda</span></Link>
          <Link href="/login" className="nav-link"><LogOut size={19} /><span>Sair da demonstração</span></Link>
          <div className="operator">
            <span className="avatar">AD</span>
            <span><strong>Administrador</strong><small>Ambiente local</small></span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <details className="mobile-menu">
            <summary aria-label="Abrir menu"><Menu size={22} /></summary>
            <div className="mobile-menu-panel"><Logo /><NavLinks /></div>
          </details>
          <div className="page-heading">
            {eyebrow && <span>{eyebrow}</span>}
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <button className="context-button" type="button">
              <CalendarDays size={17} />
              <span>Competência: jun/2026</span>
              <ChevronDown size={15} />
            </button>
            {actions}
          </div>
        </header>
        <main className="content">
          <div className="demo-notice">
            <span>{notice.label}</span>
            {notice.text}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
