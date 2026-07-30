import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  GitMerge,
  History,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { exigirAdministrador } from "@/lib/autorizacao";

const modulos = [
  {
    href: "/parametros",
    titulo: "Parâmetros fiscais",
    descricao:
      "Consulte regras, vigências e evidências usadas nos cálculos de INSS e IRRF.",
    acao: "Abrir parâmetros",
    icon: Settings2,
  },
  {
    href: "/migracoes",
    titulo: "Importação do GIW",
    descricao:
      "Acompanhe cargas, reconciliação, cobertura e histórico técnico da migração.",
    acao: "Abrir importações",
    icon: History,
  },
  {
    href: "/homologacoes",
    titulo: "Controle de fechamento",
    descricao:
      "Consulte versões congeladas, evidências e decisões formais por competência.",
    acao: "Abrir controles",
    icon: ClipboardCheck,
  },
  {
    href: "/consolidacoes",
    titulo: "Consolidação mensal",
    descricao:
      "Analise pessoas com múltiplos vínculos, rateios e decisões fiscais registradas.",
    acao: "Abrir consolidação",
    icon: GitMerge,
  },
] as const;

export default async function AdministracaoPage() {
  await exigirAdministrador();
  let organizacao = "Organização não configurada";
  try {
    organizacao = (await resolverEmpresaAtiva()).razaoSocial;
  } catch {
    // O shell apresenta o estado indisponível sem expor detalhes técnicos.
  }

  return (
    <AppShell
      title="Administração"
      eyebrow="Configuração e rastreabilidade"
      organization={organizacao}
    >
      <section className="admin-intro">
        <ShieldCheck size={22} />
        <div>
          <strong>Área reservada à configuração e ao histórico técnico</strong>
          <p>
            Estes recursos não fazem parte da rotina mensal do operador. Alterações
            em parâmetros, importações e decisões congeladas podem afetar cálculos e
            devem seguir o processo de revisão da organização.
          </p>
        </div>
      </section>

      <section className="admin-grid" aria-label="Módulos administrativos">
        {modulos.map((modulo) => {
          const Icon = modulo.icon;
          return (
            <Link className="admin-card" href={modulo.href} key={modulo.href}>
              <span className="admin-card-icon">
                <Icon size={20} />
              </span>
              <h2>{modulo.titulo}</h2>
              <p>{modulo.descricao}</p>
              <small>
                {modulo.acao} <ArrowRight size={14} />
              </small>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
