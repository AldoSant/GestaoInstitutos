import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarEnquadramentos } from "@/db/enquadramentos";
import { listarOpcoesNovaFolha } from "@/db/folhas";
import { rotaAplicacao } from "@/lib/base-path";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { NovoProcessamentoAssistente, type OpcaoProcessamento } from "./novo-processamento-assistente";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  erro?: string | string[];
  etapa?: string | string[];
  instrumento?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

export default async function NovaFolhaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const erro = primeiro(params.erro);
  const competencia = await lerCompetenciaContexto(params.competencia);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let instrumentos: Awaited<ReturnType<typeof listarOpcoesNovaFolha>>;
  let enquadramentos: Awaited<ReturnType<typeof listarEnquadramentos>>;
  try {
    empresa = await resolverEmpresaAtiva();
    [instrumentos, enquadramentos] = await Promise.all([
      listarOpcoesNovaFolha(empresa.id, competencia),
      listarEnquadramentos(empresa.id),
    ]);
  } catch {
    return (
      <AppShell title="Novo processamento" eyebrow="Folha mensal" organization="Não configurada">
        <Link href={rotaAplicacao("/folhas")} className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        <BloqueioOrientado bloqueio={{
          titulo: "Não foi possível carregar os cadastros",
          causa: "Os Termos e Metas desta competência não ficaram disponíveis agora.",
          impacto: "Nenhum processamento será criado até que a lista seja carregada.",
          acao: { rotulo: "Tentar novamente", href: "/folhas/nova" },
        }} />
      </AppShell>
    );
  }

  const competenciaData = `${competencia}-01`;
  const empresaConfigurada = enquadramentos.some(
    (item) => item.publicado && item.inicio_vigencia <= competenciaData && item.fim_vigencia >= competenciaData,
  );
  const opcoes: OpcaoProcessamento[] = instrumentos.map((item) => {
    const bloqueios = Number(item.medicoes_pendentes) + Number(item.documentos_pendentes) + Number(item.outras_fontes_pendentes);
    return {
      termoId: item.termo_id,
      termoNumero: item.termo_numero,
      metaId: item.meta_id,
      metaCodigo: item.meta_codigo,
      metaDescricao: item.meta_descricao,
      vinculosPf: Number(item.vinculos_pf),
      vinculosPj: Number(item.vinculos) - Number(item.vinculos_pf),
      bloqueios,
      contasPendentes: Number(item.contas_pendentes),
      folhaExistente: item.folha_existente,
      selecionavel: Number(item.vinculos) > 0 && !item.folha_existente && empresaConfigurada && bloqueios === 0,
    };
  });
  const etapaParametro = Number(primeiro(params.etapa));
  const passoInicial = [1, 2, 3, 4].includes(etapaParametro) ? etapaParametro : 1;

  return (
    <AppShell
      title="Novo processamento"
      eyebrow="Folha mensal"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
    >
      <Link href={rotaAplicacao("/folhas")} className="back-link"><ArrowLeft size={16} /> Voltar para folhas</Link>
      {erro && (
        <BloqueioOrientado bloqueio={orientarBloqueio({
          erro,
          competencia,
          retorno: `/folhas/nova?competencia=${competencia}&etapa=${passoInicial}`,
        })} />
      )}
      <NovoProcessamentoAssistente
        competencia={competencia}
        empresaConfigurada={empresaConfigurada}
        opcoes={opcoes}
        passoInicial={passoInicial}
        instrumentoInicial={primeiro(params.instrumento)}
      />
    </AppShell>
  );
}
