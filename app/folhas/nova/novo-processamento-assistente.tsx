"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, FileCheck2, PlayCircle, UsersRound } from "lucide-react";
import Link from "next/link";
import { caminhoAplicacao, rotaAplicacao } from "@/lib/base-path";
import { criarNovaFolha } from "../actions";

export type OpcaoProcessamento = {
  termoId: string;
  termoNumero: string;
  metaId: string;
  metaCodigo: string;
  metaDescricao: string;
  vinculosPf: number;
  vinculosPj: number;
  bloqueios: number;
  contasPendentes: number;
  folhaExistente: boolean;
  selecionavel: boolean;
};

type EstadoAssistente = { passo: number; instrumento: string };

function textoCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

export function NovoProcessamentoAssistente({
  competencia,
  empresaConfigurada,
  opcoes,
  passoInicial = 1,
  instrumentoInicial = "",
}: {
  competencia: string;
  empresaConfigurada: boolean;
  opcoes: OpcaoProcessamento[];
  passoInicial?: number;
  instrumentoInicial?: string;
}) {
  const [estado, setEstado] = useState<EstadoAssistente>({
    passo: Math.min(Math.max(passoInicial, 1), 4),
    instrumento: instrumentoInicial,
  });
  const { passo, instrumento } = estado;
  const setPasso = (novoPasso: number) => setEstado((atual) => ({ ...atual, passo: novoPasso }));
  const setInstrumento = (novoInstrumento: string) => setEstado((atual) => ({ ...atual, instrumento: novoInstrumento }));
  const opcoesDisponiveis = useMemo(() => opcoes.filter((item) => item.selecionavel), [opcoes]);
  const selecionada = opcoesDisponiveis.find((item) => `${item.termoId}:${item.metaId}` === instrumento);
  const etapasVisiveis = [
    "Competência",
    ...(empresaConfigurada ? [] : ["Empresa"]),
    "Termo e Meta",
    "Conferência",
  ];
  const passoVisivel = empresaConfigurada
    ? passo === 1
      ? 1
      : passo === 3
        ? 2
        : 3
    : passo;

  const avancarDaCompetencia = () => setPasso(empresaConfigurada ? 3 : 2);
  const retornarParaCompetencia = () => setPasso(1);
  const destinoConfiguracao = `/configuracao-inicial?competencia=${competencia}&retorno=${encodeURIComponent(`/folhas/nova?competencia=${competencia}&etapa=2&instrumento=${encodeURIComponent(instrumento)}`)}`;

  return (
    <section className="processamento-assistente" aria-label="Assistente de novo processamento">
      <ol className="assistente-progresso" aria-label="Progresso do processamento">
        {etapasVisiveis.map((rotulo, indice) => {
          const numero = indice + 1;
          const concluido = numero < passoVisivel;
          return <li key={rotulo} className={numero === passoVisivel ? "atual" : concluido ? "concluido" : ""}><span>{concluido ? <CheckCircle2 size={14} /> : numero}</span><small>{rotulo}</small></li>;
        })}
      </ol>

      {passo === 1 && (
        <article className="assistente-card">
          <span className="section-kicker">Passo 1 de {empresaConfigurada ? 3 : 4}</span>
          <h2>Qual competência você quer preparar?</h2>
          <p>Escolha o mês da folha. Nada será criado nesta etapa.</p>
          <form action={caminhoAplicacao("/folhas/nova")} method="get" className="assistente-form">
            <label>
              <span>Competência</span>
              <input name="competencia" type="month" required defaultValue={competencia} />
            </label>
            <button className="button secondary" type="submit">Atualizar mês</button>
          </form>
          <div className="assistente-acoes">
            <Link className="button secondary" href={rotaAplicacao("/folhas")}><ArrowLeft size={16} /> Cancelar</Link>
            <button className="button primary" type="button" onClick={avancarDaCompetencia}>Continuar <ChevronRight size={16} /></button>
          </div>
        </article>
      )}

      {passo === 2 && !empresaConfigurada && (
        <article className="assistente-card">
          <span className="section-kicker">Passo 2 de 4</span>
          <h2>Antes de calcular, confirme a empresa</h2>
          <p>O enquadramento previdenciário ainda não cobre {textoCompetencia(competencia)}.</p>
          <section className="assistente-alerta" role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>O que isso impede?</strong>
              <p>Sem essa confirmação, o sistema não pode calcular contribuições com segurança.</p>
            </div>
          </section>
          <div className="assistente-acoes">
            <button className="button secondary" type="button" onClick={retornarParaCompetencia}><ArrowLeft size={16} /> Voltar</button>
            <Link className="button primary" href={rotaAplicacao(destinoConfiguracao)}>Configurar empresa <ChevronRight size={16} /></Link>
          </div>
        </article>
      )}

      {passo === 3 && (
        <article className="assistente-card">
          <span className="section-kicker">Passo {empresaConfigurada ? 2 : 3} de {empresaConfigurada ? 3 : 4}</span>
          <h2>Qual Termo e Meta serão processados?</h2>
          <p>Um processamento por vez. Apenas instrumentos disponíveis para esta competência são exibidos.</p>
          {opcoesDisponiveis.length ? (
            <>
              <label className="assistente-selecao">
                <span>Termo e Meta</span>
                <select value={instrumento} onChange={(event) => setInstrumento(event.target.value)}>
                  <option value="">Selecione para continuar</option>
                  {opcoesDisponiveis.map((item) => (
                    <option key={item.metaId} value={`${item.termoId}:${item.metaId}`}>
                      Termo {item.termoNumero} · Meta {item.metaCodigo} — {item.metaDescricao}
                    </option>
                  ))}
                </select>
              </label>
              {selecionada && (
                <div className="assistente-resumo-selecao">
                  <UsersRound size={20} />
                  <div><strong>{selecionada.vinculosPf} PF e {selecionada.vinculosPj} PJ serão incluídos</strong><p>Contas pendentes não impedem o cálculo; elas serão sinalizadas antes do pagamento.</p></div>
                </div>
              )}
            </>
          ) : (
            <section className="assistente-alerta" role="alert">
              <AlertTriangle size={20} />
              <div><strong>Nenhum Termo e Meta está disponível</strong><p>Revise vínculos, medições e instrumentos ativos da competência antes de continuar.</p></div>
              <Link className="button secondary" href={rotaAplicacao(`/termos-e-metas?competencia=${competencia}`)}>Revisar instrumentos</Link>
            </section>
          )}
          <div className="assistente-acoes">
            <button className="button secondary" type="button" onClick={() => setPasso(empresaConfigurada ? 1 : 2)}><ArrowLeft size={16} /> Voltar</button>
            <button className="button primary" type="button" disabled={!selecionada} onClick={() => setPasso(4)}>Conferir processamento <ChevronRight size={16} /></button>
          </div>
        </article>
      )}

      {passo === 4 && selecionada && (
        <article className="assistente-card">
          <span className="section-kicker">Último passo</span>
          <h2>Confira antes de gerar</h2>
          <p>Revise o escopo. A Folha só será criada ao confirmar abaixo.</p>
          <dl className="assistente-conferencia">
            <div><dt>Competência</dt><dd>{textoCompetencia(competencia)}</dd></div>
            <div><dt>Instrumento</dt><dd>Termo {selecionada.termoNumero} · Meta {selecionada.metaCodigo}</dd></div>
            <div><dt>Prestadores</dt><dd>{selecionada.vinculosPf} PF · {selecionada.vinculosPj} PJ</dd></div>
          </dl>
          {selecionada.contasPendentes > 0 && <section className="assistente-alerta neutro"><FileCheck2 size={20} /><div><strong>{selecionada.contasPendentes} conta(s) serão conferidas depois</strong><p>Isso não bloqueia o cálculo, mas a relação de pagamentos ficará pendente até a regularização.</p></div></section>}
          <form action={criarNovaFolha}>
            <input name="competencia" type="hidden" value={competencia} />
            <input name="instrumento" type="hidden" value={instrumento} />
            <div className="assistente-acoes">
              <button className="button secondary" type="button" onClick={() => setPasso(3)}><ArrowLeft size={16} /> Ajustar seleção</button>
              <button className="button primary" type="submit"><PlayCircle size={16} /> Gerar processamento</button>
            </div>
          </form>
        </article>
      )}
    </section>
  );
}
