import { cookies } from "next/headers";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import {
  BarraLateral,
  Logo,
  NavegacaoPrincipal,
} from "@/components/app-navigation";
import { CompetenciaSwitcher } from "@/components/competencia-switcher";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarCompetenciasDisponiveis } from "@/db/competencias";
import {
  competenciaCalendario,
  COOKIE_COMPETENCIA,
  primeiraCompetencia,
} from "@/lib/competencia";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/sessao";

function iniciais(login: string) {
  const partes = login
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (partes.length === 0) return "US";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export async function AppShell({
  children,
  title,
  eyebrow,
  actions,
  organization = "Organização não configurada",
  notice,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  organization?: string;
  notice?: { label: string; text: string };
}) {
  const jar = await cookies();
  const sessao = lerTokenSessao(jar.get(COOKIE_SESSAO)?.value);
  const login = sessao?.login ?? "Usuário";
  const perfil = sessao?.perfil === "ADMINISTRADOR" ? "Administrador" : "Operador";
  const selecionada =
    primeiraCompetencia(jar.get(COOKIE_COMPETENCIA)?.value) ??
    competenciaCalendario();
  let competencias: string[] = [];
  try {
    const empresa = await resolverEmpresaAtiva();
    competencias = await listarCompetenciasDisponiveis(empresa.id);
  } catch {
    // O seletor continua utilizável mesmo durante indisponibilidade do banco.
  }
  competencias = [...new Set([selecionada, competenciaCalendario(), ...competencias])]
    .sort()
    .reverse();

  return (
    <div className="app-frame">
      <BarraLateral
        organization={organization}
        login={login}
        perfil={perfil}
        iniciais={iniciais(login)}
      />

      <div className="main-column">
        <header className="topbar">
          <details className="mobile-menu">
            <summary aria-label="Abrir menu">
              <Menu size={22} />
            </summary>
            <div className="mobile-menu-panel">
              <Logo />
              <NavegacaoPrincipal />
            </div>
          </details>
          <div className="page-heading">
            {eyebrow && <span>{eyebrow}</span>}
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <CompetenciaSwitcher
              competencias={competencias}
              selecionada={selecionada}
            />
            {actions}
          </div>
        </header>
        <main className="content">
          {notice && (
            <div className="demo-notice" role="status">
              <span>{notice.label}</span>
              {notice.text}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
