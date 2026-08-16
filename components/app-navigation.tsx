"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  ChevronDown,
  Database,
  FileCheck2,
  FileLock2,
  FileText,
  Gauge,
  Link2,
  ListChecks,
  ReceiptText,
  Settings2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { caminhoAplicacao } from "@/lib/base-path";
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
    <Link href="/" className="brand" aria-label="Veredas Gestão de Institutos — início">
      <Image
        src={caminhoAplicacao("/veredas/veredas-lockup-silver.svg")}
        alt="Veredas"
        width={136}
        height={40}
        priority
        unoptimized
      />
      <span className="brand-product">Gestão de Institutos</span>
    </Link>
  );
}

export function NavegacaoPrincipal({
  administrador = false,
}: {
  administrador?: boolean;
}) {
  return (
    <nav className="nav-list" aria-label="Navegação principal">
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
      {administrador && <NavLink item={{ href: ROTAS.administracao, label: "Administração", icon: Settings2 }} />}
    </nav>
  );
}
