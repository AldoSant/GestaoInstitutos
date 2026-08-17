import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  CreditCard,
  FileText,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { FolhaJornadaProgresso } from "@/components/folha-jornada-progresso";
import { ProcessingAutoRefresh } from "@/components/processing-auto-refresh";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { diagnosticarConsolidacaoMensal } from "@/db/consolidacoes";
import { carregarFolha } from "@/db/folhas";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";
import { descreverProcessamento } from "@/lib/processamento-operacional";
import {
  fechar,
  registrarConferencia,
  tentarNovamenteProcessamento,
} from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function competencia(valor: string) {
  const [ano, mes] = valor.split("-");
  return `${mes}/${ano}`;
}

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export default async function FolhaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ competencia: string }>;
  searchParams: SearchParams;
}) {
  const { competencia: folhaId } = await params;
  const mensagens = await searchParams;
  const erro = primeiro(mensagens.erro);
  const sucesso = primeiro(mensagens.sucesso);
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let dados: Awaited<ReturnType<typeof carregarFolha>>;
  let diagnosticoConsolidacao: Awaited<
    ReturnType<typeof diagnosticarConsolidacaoMensal>
  > | null = null;
  try {
    empresa = await resolverEmpresaAtiva();
    dados = await carregarFolha(empresa.id, folhaId);
  } catch {
    notFound();
  }
  try {
    diagnosticoConsolidacao = await diagnosticarConsolidacaoMensal(
      empresa.id,
      dados.folha.competencia.slice(0, 7),
    );
  } catch {
    // É um diagnóstico complementar: a jornada continua disponível.
  }

  const folha = dados.folha;
  const conferenciaAtual = dados.conferencias.find(
    (item) => item.hash_resultado === folha.hash_resultado,
  );
  const calculada = Boolean(folha.hash_resultado && dados.itens.length);
  const aprovadaPeloRh = conferenciaAtual?.resultado === "APROVADA";
  const fechada = folha.status === "FECHADA";
  const processamentoFalhou = dados.processamento?.status === "FALHA";
  const estadoProcessamento = dados.processamento
    ? descreverProcessamento(
        dados.processamento.status,
        dados.processamento.ultimo_erro,
      )
    : null;
  const pagamentosAptos = dados.itens.filter((item) => {
    const snapshots = item.snapshots as Record<string, unknown>;
    const conta = snapshots.contaBancaria;
    if (!conta || typeof conta !== "object") return false;
    const dadosConta = conta as Record<string, unknown>;
    return Boolean(
      String(dadosConta.agencia ?? "").trim() &&
        String(dadosConta.numero ?? "").trim() &&
        ["CORRENTE", "POUPANCA"].includes(String(dadosConta.tipo ?? "")),
    );
  }).length;
  const vinculosDaFolha = new Set(dados.itens.map((item) => item.vinculo_id));
  const conflitosDestaFolha =
    diagnosticoConsolidacao?.conflitos.filter((conflito) =>
      conflito.fontes.some((fonte) => vinculosDaFolha.has(fonte.vinculoId)),
    ) ?? [];
  const totais = dados.itens.reduce(
    (total, item) => ({
      proventos: total.proventos + Number(item.total_proventos),
      inss: total.inss + Number(item.valor_inss),
      irrf: total.irrf + Number(item.valor_irrf),
      liquido: total.liquido + Number(item.total_liquido),
    }),
    { proventos: 0, inss: 0, irrf: 0, liquido: 0 },
  );
  const etapaAtual = !calculada ? 1 : !aprovadaPeloRh ? 2 : !fechada ? 3 : 4;

  return (
    <AppShell
      title={`Processamento ${competencia(folha.competencia)}`}
      eyebrow={`Termo ${folha.termo_numero} · Meta ${folha.meta_codigo} · lote ${folha.numero}`}
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      actions={
        <Link className="button secondary" href={`/folhas/${folha.id}/consulta`}>
          <FileText size={16} /> Consulta completa
        </Link>
      }
    >
      <Link href="/folhas" className="back-link">
        <ArrowLeft size={16} /> Voltar para processamentos
      </Link>

      {erro && (
        <BloqueioOrientado
          bloqueio={orientarBloqueio({
            erro,
            competencia: folha.competencia.slice(0, 7),
            retorno: `/folhas/${folha.id}`,
          })}
        />
      )}
      {sucesso && (
        <section className="feedback-banner success" role="status">
          <strong>Operação concluída</strong><span>{sucesso}</span>
        </section>
      )}

      <section className="jornada-resumo quiet-journey-summary" aria-label="Resumo do processamento">
        <div>
          <span>Prestadores</span><strong>{dados.itens.length}</strong>
        </div>
        <div>
          <span>Líquido previsto</span><strong>{moeda(totais.liquido)}</strong>
        </div>
        <div>
          <span>INSS e IRRF</span><strong>{moeda(totais.inss + totais.irrf)}</strong>
        </div>
      </section>

      <FolhaJornadaProgresso etapaAtual={etapaAtual} />

      {etapaAtual === 1 && (
        <section className={`jornada-card quiet-journey-decision ${processamentoFalhou ? "alerta" : ""}`}>
          {processamentoFalhou ? <AlertTriangle size={24} /> : <RefreshCw size={24} />}
          <div>
            <span className="section-kicker">Passo 1 de 6</span>
            <h2>{estadoProcessamento?.titulo ?? "Calculando o processamento"}</h2>
            <p>{estadoProcessamento?.texto ?? "A Folha está na fila e será calculada automaticamente."}</p>
          </div>
          <div className="jornada-acoes">
            {processamentoFalhou ? (
              <form action={tentarNovamenteProcessamento}>
                <input type="hidden" name="folhaId" value={folha.id} />
                <button className="button primary" type="submit">
                  <RefreshCw size={16} /> Tentar novamente
                </button>
              </form>
            ) : (
              <>
                <ProcessingAutoRefresh
                  active={["PENDENTE", "EXECUTANDO"].includes(dados.processamento?.status ?? "")}
                />
                <Link className="button secondary" href={`/folhas/${folha.id}`}>
                  <RefreshCw size={16} /> Atualizar agora
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      {etapaAtual === 2 && (
        <section className="jornada-card quiet-journey-decision">
          <ClipboardCheck size={24} />
          <div>
            <span className="section-kicker">Passo 2 de 6</span>
            <h2>Conferência do RH</h2>
            <p>Confirme cadastros, valores e rubricas desta revisão antes de fechar.</p>
          </div>
          {conflitosDestaFolha.length > 0 && (
            <section className="jornada-alerta" role="alert">
              <AlertTriangle size={20} />
              <div>
                <strong>Consolidação fiscal necessária</strong>
                <p>Há pagamento da mesma pessoa em outro lote desta competência.</p>
              </div>
              <Link
                className="button secondary"
                href={`/conferencia-entre-folhas?competencia=${folha.competencia.slice(0, 7)}&retorno=${encodeURIComponent(`/folhas/${folha.id}`)}`}
              >
                Consolidar impostos
              </Link>
            </section>
          )}
          <form action={registrarConferencia} className="jornada-form">
            <input type="hidden" name="folhaId" value={folha.id} />
            <label>
              <span>Resultado</span>
              <select name="resultado" required defaultValue="APROVADA">
                <option value="APROVADA">Aprovar revisão</option>
                <option value="REJEITADA">Solicitar correção</option>
              </select>
            </label>
            <label>
              <span>Responsável</span>
              <input name="conferente" required minLength={3} maxLength={160} placeholder="Nome de quem conferiu" />
            </label>
            <fieldset>
              <legend>O que foi conferido?</legend>
              <label><input type="checkbox" name="confirmouCadastros" /> Cadastros</label>
              <label><input type="checkbox" name="confirmouValores" /> Valores e líquido</label>
              <label><input type="checkbox" name="confirmouRubricas" /> Rubricas e incidências</label>
            </fieldset>
            <label className="field-wide">
              <span>Observação — obrigatória se houver rejeição</span>
              <input name="observacao" maxLength={2000} placeholder="Registre a correção necessária ou ressalva" />
            </label>
            <button className="button primary" type="submit">
              <ClipboardCheck size={16} /> Registrar decisão
            </button>
          </form>
        </section>
      )}

      {etapaAtual === 3 && (
        <section className="jornada-card quiet-journey-decision">
          <LockKeyhole size={24} />
          <div>
            <span className="section-kicker">Passo 3 de 6</span>
            <h2>Fechar esta revisão</h2>
            <p>A aprovação do RH foi registrada. O fechamento congela a memória e libera os pagamentos.</p>
          </div>
          <dl className="jornada-valores">
            <div><dt>Proventos</dt><dd>{moeda(totais.proventos)}</dd></div>
            <div><dt>INSS</dt><dd>{moeda(totais.inss)}</dd></div>
            <div><dt>IRRF</dt><dd>{moeda(totais.irrf)}</dd></div>
            <div><dt>Líquido</dt><dd>{moeda(totais.liquido)}</dd></div>
          </dl>
          <form action={fechar} className="jornada-acoes">
            <input type="hidden" name="folhaId" value={folha.id} />
            <button className="button primary" type="submit">
              <LockKeyhole size={16} /> Fechar Folha
            </button>
          </form>
        </section>
      )}

      {etapaAtual === 4 && (
        <section className="jornada-card quiet-journey-decision">
          <CreditCard size={24} />
          <div>
            <span className="section-kicker">Passo 4 de 6</span>
            <h2>Preparar pagamentos</h2>
            <p>A Folha está fechada. Gere a relação bancária e trate as contas pendentes antes da liberação.</p>
          </div>
          <dl className="jornada-valores">
            <div><dt>Prestadores</dt><dd>{dados.itens.length}</dd></div>
            <div><dt>Contas aptas</dt><dd>{pagamentosAptos}</dd></div>
            <div><dt>Contas pendentes</dt><dd>{dados.itens.length - pagamentosAptos}</dd></div>
            <div><dt>Total líquido</dt><dd>{moeda(totais.liquido)}</dd></div>
          </dl>
          <div className="jornada-acoes">
            <Link className="button primary" href={`/folhas/${folha.id}/pagamentos`}>
              <CreditCard size={16} /> Continuar para pagamentos
            </Link>
            <Link className="button secondary" href={`/folhas/${folha.id}/consulta`}>
              <FileText size={16} /> Ver consulta completa
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
