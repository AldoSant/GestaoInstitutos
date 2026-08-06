import { AlertTriangle, ArrowLeft, CircleCheck, Settings2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarEnquadramentos } from "@/db/enquadramentos";
import { exigirAdministrador } from "@/lib/autorizacao";
import { caminhoAplicacao } from "@/lib/base-path";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { nomeRegimePrevidenciario } from "@/lib/enquadramento-previdenciario";
import { EnquadramentoInicialForm } from "./enquadramento-inicial-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ competencia?: string | string[]; erro?: string | string[] }>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

export default async function ConfiguracaoInicialPage({ searchParams }: { searchParams: SearchParams }) {
  await exigirAdministrador();
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const competenciaData = `${competencia}-01`;
  const empresa = await resolverEmpresaAtiva();
  const enquadramentos = await listarEnquadramentos(empresa.id);
  const vigente = enquadramentos.find(
    (item) => item.publicado && item.inicio_vigencia <= competenciaData && item.fim_vigencia >= competenciaData,
  );
  const erro = primeiro(params.erro);

  return (
    <AppShell title="Configuração inicial" eyebrow="Empresa · uma vez" organization={empresa.nomeFantasia ?? empresa.razaoSocial}>
      <Link href={caminhoAplicacao(`/folhas/nova?competencia=${competencia}`)} className="back-link"><ArrowLeft size={16} /> Voltar à folha</Link>
      {erro && <section className="feedback-banner error" role="alert"><strong>Configuração não concluída</strong><span>{erro}</span></section>}
      {vigente ? (
        <section className="panel onboarding-complete">
          <CircleCheck size={28} />
          <div>
            <span className="section-kicker">Empresa configurada</span>
            <h2>{nomeRegimePrevidenciario(vigente.regime)}</h2>
            <p>Já existe uma vigência publicada para {competencia}. Volte à folha para continuar. Alterações legais futuras exigem uma nova vigência auditável.</p>
          </div>
          <Link className="button primary" href={caminhoAplicacao(`/folhas/nova?competencia=${competencia}`)}>Continuar para a folha</Link>
        </section>
      ) : (
        <>
          <section className="onboarding-hero">
            <div className="onboarding-hero-icon"><Settings2 size={25} /></div>
            <div>
              <span className="section-kicker">Primeiro acesso da empresa</span>
              <h2>Antes do primeiro processamento, confirme o enquadramento do IGP</h2>
              <p>Esta decisão define somente a contribuição da empresa contratante. Ela será versionada e congelada nas folhas, sem criar uma tela técnica recorrente na rotina do RH.</p>
            </div>
          </section>
          <section className="alert-box warning">
            <AlertTriangle size={22} />
            <div><strong>Não escolha CEBAS apenas por ser instituto ou sem fins lucrativos</strong><p>Esta opção requer CEBAS válido cobrindo toda a vigência. Contrato público tampouco equivale a administração pública.</p></div>
          </section>
          <section className="panel cadastro-section">
            <div className="panel-header"><div><span className="section-kicker">Decisão da empresa</span><h2>Enquadramento previdenciário</h2><p>Use a confirmação do RH/contabilidade. Os casos não cobertos não são apresentados como opção para evitar alíquota presumida.</p></div></div>
            <EnquadramentoInicialForm competencia={competencia} inicioPadrao={`${competencia.slice(0, 4)}-01-01`} />
          </section>
        </>
      )}
    </AppShell>
  );
}
