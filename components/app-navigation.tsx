"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  ChevronDown,
  CircleHelp,
  Database,
  FileCheck2,
  FileLock2,
  FileText,
  Gauge,
  Link2,
  ListChecks,
  LogOut,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { sair } from "@/app/login/actions";
import { ROTAS } from "@/lib/rotas";

type ItemNavegacao = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const pessoasEVinculos: ItemNavegacao[] = [
  { href: ROTAS.pessoas, label: "Cadastros", icon: Database },
  { href: ROTAS.prestadores, label: "Prestadores", icon: UsersRound },
  { href: ROTAS.vinculos, label: "Vínculos", icon: Link2 },
];

const instrumentosELancamentos: ItemNavegacao[] = [
  { href: ROTAS.instrumentos, label: "Termos e metas", icon: FileText },
  { href: ROTAS.medicoes, label: "Medições", icon: ListChecks },
  { href: ROTAS.eventos, label: "Eventos e lançamentos", icon: ReceiptText },
];

function estaAtivo(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function NavLink({ item }: { item: ItemNavegacao }) {
  const pathname = usePathname();
  const Icon = item.icon;
  const ativo = estaAtivo(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={ativo ? "nav-link active" : "nav-link"}
      aria-current={ativo ? "page" : undefined}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

function GrupoNavegacao({
  label,
  icon: Icon,
  itens,
}: {
  label: string;
  icon: LucideIcon;
  itens: ItemNavegacao[];
}) {
  const pathname = usePathname();
  const ativo = itens.some((item) => estaAtivo(pathname, item.href));

  return (
    <details className="nav-disclosure" open={ativo}>
      <summary className={ativo ? "nav-group-label active" : "nav-group-label"}>
        <Icon size={19} strokeWidth={1.8} />
        <span>{label}</span>
        <ChevronDown className="nav-chevron" size={15} />
      </summary>
      <div className="nav-children">
        {itens.map((item) => (
          <NavLink item={item} key={item.href} />
        ))}
      </div>
    </details>
  );
}

export function Logo() {
  return (
    <Link href="/" className="brand" aria-label="Gestão Institutos — início">
      <span className="brand-mark">
        <ShieldCheck size={22} />
      </span>
      <span>
        <strong>Gestão Institutos</strong>
        <small>Folha e obrigações</small>
      </span>
    </Link>
  );
}

export function NavegacaoPrincipal({
}: {
  administrador?: boolean;
}) {
  return (
    <nav className="nav-list" aria-label="Navegação principal">
      <span className="nav-section-label">Rotina mensal</span>
      <NavLink item={{ href: ROTAS.inicio, label: "Visão do mês", icon: Gauge }} />
      <NavLink
        item={{ href: ROTAS.folhaMensal, label: "Folha mensal", icon: BadgeDollarSign }}
      />
      <NavLink
        item={{ href: ROTAS.obrigacoes, label: "Obrigações e GPS", icon: FileCheck2 }}
      />
      <NavLink
        item={{ href: ROTAS.fechamentoMensal, label: "Fechamento consolidado", icon: FileLock2 }}
      />
      <span className="nav-section-label nav-section-label-secondary">Base operacional</span>
      <GrupoNavegacao
        label="Pessoas e vínculos"
        icon={UsersRound}
        itens={pessoasEVinculos}
      />
      <GrupoNavegacao
        label="Instrumentos e lançamentos"
        icon={FileText}
        itens={instrumentosELancamentos}
      />
    </nav>
  );
}

export function BarraLateral({
  organization,
  login,
  perfil,
  iniciais,
  administrador,
}: {
  organization: string;
  login: string;
  perfil: string;
  iniciais: string;
  administrador: boolean;
}) {
  return (
    <aside className="sidebar">
      <Logo />
      <div className="tenant-card" aria-label={`Organização ativa: ${organization}`}>
        <Building2 size={17} />
        <span>
          <small>Organização ativa</small>
          <strong>{organization}</strong>
        </span>
      </div>
      <NavegacaoPrincipal administrador={administrador} />
      <div className="sidebar-bottom">
        <Link href={ROTAS.ajuda} className="nav-link">
          <CircleHelp size={19} />
          <span>Ajuda</span>
        </Link>
        <form action={sair}>
          <button type="submit" className="nav-link logout-button">
            <LogOut size={19} />
            <span>Sair</span>
          </button>
        </form>
        <div className="operator">
          <span className="avatar">{iniciais}</span>
          <span>
            <strong>{login}</strong>
            <small>{perfil}</small>
          </span>
        </div>
      </div>
    </aside>
  );
}
