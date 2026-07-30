"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  GitMerge,
  History,
  Link2,
  ListChecks,
  LogOut,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { sair } from "@/app/login/actions";

type ItemNavegacao = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const pessoas: ItemNavegacao[] = [
  { href: "/cadastros", label: "Pessoas", icon: Database },
  { href: "/prestadores", label: "Prestadores", icon: UsersRound },
  { href: "/vinculos", label: "Vínculos", icon: Link2 },
  { href: "/instrumentos", label: "Termos e metas", icon: FileText },
  { href: "/medicoes", label: "Medições", icon: ListChecks },
  { href: "/eventos", label: "Eventos e lançamentos", icon: ReceiptText },
];

const administracao: ItemNavegacao[] = [
  { href: "/homologacoes", label: "Fechamento mensal", icon: ClipboardCheck },
  { href: "/consolidacoes", label: "Conferência entre folhas", icon: GitMerge },
  { href: "/migracoes", label: "Importação do GIW", icon: History },
  { href: "/parametros", label: "Parâmetros fiscais", icon: Settings2 },
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

export function NavegacaoPrincipal() {
  return (
    <nav className="nav-list" aria-label="Navegação principal">
      <span className="nav-section-label">Operação</span>
      <NavLink item={{ href: "/", label: "Visão geral", icon: Gauge }} />
      <NavLink
        item={{ href: "/folhas", label: "Folha mensal", icon: BadgeDollarSign }}
      />
      <GrupoNavegacao
        label="Pessoas e vínculos"
        icon={UsersRound}
        itens={pessoas}
      />
      <NavLink
        item={{
          href: "/obrigacoes",
          label: "Obrigações e guias",
          icon: FileCheck2,
        }}
      />
      <GrupoNavegacao
        label="Administração"
        icon={Settings2}
        itens={administracao}
      />
    </nav>
  );
}

export function BarraLateral({
  organization,
  login,
  perfil,
  iniciais,
}: {
  organization: string;
  login: string;
  perfil: string;
  iniciais: string;
}) {
  return (
    <aside className="sidebar">
      <Logo />
      <div className="tenant-card">
        <Building2 size={17} />
        <span>
          <small>Organização</small>
          <strong>{organization}</strong>
        </span>
      </div>
      <NavegacaoPrincipal />
      <div className="sidebar-bottom">
        <Link href="/ajuda" className="nav-link">
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
