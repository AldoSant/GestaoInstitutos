import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarRange,
  Database,
  Pencil,
  Percent,
  Power,
  ReceiptText,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarEventos } from "@/db/eventos";
import {
  alternarEvento,
  alternarEventoRecorrente,
  salvarEvento,
  salvarEventoRecorrente,
} from "./actions";

export const metadata: Metadata = { title: "Eventos" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  busca?: string | string[];
  editarEvento?: string | string[];
  editarRecorrente?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function nomeNatureza(value: string) {
  if (value === "PROVENTO") return "Provento";
  if (value === "DESCONTO") return "Desconto";
  return "Informativo";
}

function competencia(value: string | null) {
  if (!value) return "sem término";
  const [ano, mes] = value.split("-");
  return `${mes}/${ano}`;
}

function valor(value: string, tipo: string) {
  if (tipo === "PERCENTUAL") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(Number(value))}%`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function Alternar({
  action,
  id,
  ativo,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  ativo: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button className="row-text-action" type="submit">
        <Power size={13} /> {ativo ? "Inativar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function EventosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const busca = primeiro(params.busca).trim();
  const editarEventoId = primeiro(params.editarEvento);
  const editarRecorrenteId = primeiro(params.editarRecorrente);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);

  let dados: Awaited<ReturnType<typeof carregarEventos>>;
  try {
    dados = await carregarEventos(busca);
  } catch (error) {
    return (
      <AppShell
        title="Eventos"
        eyebrow="PostgreSQL"
        organization="Não configurada"
        notice={{
          label: "Configuração necessária",
          text: "Esta área requer a migração de Eventos e uma empresa ativa.",
        }}
      >
        <section className="alert-box danger">
          <Database size={22} />
          <div><strong>Eventos indisponíveis</strong><p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p></div>
        </section>
      </AppShell>
    );
  }

  const eventoEditado = dados.eventos.find((item) => item.id === editarEventoId);
  const recorrenteEditado = dados.recorrentes.find(
    (item) => item.id === editarRecorrenteId,
  );
  const recorrenciaDisponivel =
    dados.opcoesEventos.length > 0 && dados.opcoesVinculos.length > 0;

  return (
    <AppShell
      title="Eventos"
      eyebrow="Rubricas e recorrências"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
      notice={{
        label: "Operacional",
        text: "Eventos e lançamentos recorrentes são persistidos; o processamento mensal ainda será implementado.",
      }}
    >
      {(erro || sucesso) && (
        <section className={`feedback-banner ${erro ? "error" : "success"}`} role="status">
          <strong>{erro ? "Operação não concluída" : "Operação concluída"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      <section className="cadastro-toolbar panel">
        <div>
          <span className="section-kicker">Entradas da folha</span>
          <h2>Eventos e lançamentos por Vínculo</h2>
          <p>Natureza, incidências e vigência são validadas antes de chegar ao motor.</p>
        </div>
        <form action="/eventos" method="get" className="search-field">
          <Search size={17} />
          <label className="sr-only" htmlFor="busca-eventos">Buscar Eventos</label>
          <input id="busca-eventos" name="busca" type="search" defaultValue={busca} placeholder="Evento, prestador, termo ou meta" />
          {busca && <Link href="/eventos" aria-label="Limpar busca"><X size={15} /></Link>}
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo dos Eventos">
        <article className="metric-card"><div className="metric-icon"><ReceiptText size={21} /></div><div className="metric-copy"><span>Eventos</span><strong>{dados.totais.eventos_total}</strong><small>{dados.totais.eventos_ativos} ativos</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><CalendarRange size={21} /></div><div className="metric-copy"><span>Recorrências</span><strong>{dados.totais.recorrentes_ativos}</strong><small>lançamentos ativos</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><ShieldCheck size={21} /></div><div className="metric-copy"><span>Base de INSS</span><strong>{dados.totais.eventos_com_inss}</strong><small>Eventos ativos</small></div></article>
      </section>

      <section className="panel cadastro-section" id="cadastro">
        <div className="panel-header"><div><span className="section-kicker">Rubrica</span><h2>{eventoEditado ? "Editar Evento" : "Novo Evento"}</h2><p>Cadastre o significado da rubrica antes de informar valores.</p></div><StatusBadge tone="info">{dados.eventos.length} exibidos</StatusBadge></div>
        <form action={salvarEvento} className="crud-form evento-form">
          <input type="hidden" name="id" value={eventoEditado?.id ?? ""} />
          <label><span>Código</span><input name="codigo" required maxLength={40} defaultValue={eventoEditado?.codigo ?? ""} /></label>
          <label className="field-wide"><span>Descrição</span><input name="descricao" required maxLength={180} defaultValue={eventoEditado?.descricao ?? ""} /></label>
          <label><span>Natureza</span><select name="natureza" required defaultValue={eventoEditado?.natureza ?? "PROVENTO"}><option value="PROVENTO">Provento</option><option value="DESCONTO">Desconto</option><option value="INFORMATIVO">Informativo</option></select></label>
          <label><span>Tipo de cálculo</span><select name="tipoCalculo" required defaultValue={eventoEditado?.tipoCalculo ?? "VALOR"}><option value="VALOR">Valor</option><option value="PERCENTUAL">Percentual</option></select></label>
          <label className="checkbox-field"><input name="incideInss" type="checkbox" defaultChecked={eventoEditado?.incideInss ?? false} /><span>Compõe base de INSS</span></label>
          <label className="checkbox-field"><input name="incideIrrf" type="checkbox" defaultChecked={eventoEditado?.incideIrrf ?? false} /><span>Compõe base de IRRF</span></label>
          <button className="button primary" type="submit">{eventoEditado ? "Salvar Evento" : "Cadastrar Evento"}</button>
          {eventoEditado && <Link className="button secondary" href="/eventos#cadastro">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Natureza</th><th>Cálculo</th><th>Incidências</th><th>Recorrências</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.eventos.map((item) => <tr key={item.id}><td><strong>{item.codigo}</strong></td><td>{item.descricao}</td><td><StatusBadge tone={item.natureza === "PROVENTO" ? "success" : item.natureza === "DESCONTO" ? "warning" : "neutral"}>{nomeNatureza(item.natureza)}</StatusBadge></td><td>{item.tipoCalculo === "PERCENTUAL" ? <><Percent size={13} /> Percentual</> : <><BadgeDollarSign size={13} /> Valor</>}</td><td>{item.incideInss ? "INSS" : "—"}<small>{item.incideIrrf ? "IRRF" : "Sem IRRF"}</small></td><td>{item.totalRecorrentes}</td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/eventos?editarEvento=${item.id}#cadastro`}><Pencil size={13} /> Editar</Link><Alternar action={alternarEvento} id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.eventos.length === 0 && <tr><td colSpan={8} className="empty-cell">Nenhum Evento encontrado.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel cadastro-section" id="recorrentes">
        <div className="panel-header"><div><span className="section-kicker">Vigência mensal</span><h2>{recorrenteEditado ? "Editar recorrência" : "Novo lançamento recorrente"}</h2><p>O mesmo Evento não pode possuir vigências ativas sobrepostas no Vínculo.</p></div><StatusBadge tone={recorrenciaDisponivel ? "success" : "warning"}>{recorrenciaDisponivel ? "Cadastros prontos" : "Cadastre Evento e Vínculo"}</StatusBadge></div>
        <form action={salvarEventoRecorrente} className="crud-form recorrente-form">
          <input type="hidden" name="id" value={recorrenteEditado?.id ?? ""} />
          <label className="field-wide"><span>Vínculo</span><select name="vinculoId" required defaultValue={recorrenteEditado?.vinculoId ?? ""}><option value="" disabled>Selecione um Vínculo</option>{dados.opcoesVinculos.map((item) => <option key={item.id} value={item.id}>{item.prestadorNome} · {item.matricula} · Termo {item.termoNumero}/{item.metaCodigo}</option>)}</select></label>
          <label className="field-wide"><span>Evento</span><select name="eventoId" required defaultValue={recorrenteEditado?.eventoId ?? ""}><option value="" disabled>Selecione um Evento</option>{dados.opcoesEventos.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.descricao} · {item.tipoCalculo === "PERCENTUAL" ? "%" : "R$"}</option>)}</select></label>
          <label><span>Valor / percentual</span><input name="valor" required inputMode="decimal" placeholder="0,00" defaultValue={recorrenteEditado?.valor ?? ""} /></label>
          <label><span>Competência inicial</span><input name="inicioCompetencia" type="month" required defaultValue={recorrenteEditado?.inicioCompetencia.slice(0, 7) ?? ""} /></label>
          <label><span>Competência final</span><input name="fimCompetencia" type="month" defaultValue={recorrenteEditado?.fimCompetencia?.slice(0, 7) ?? ""} /></label>
          <button className="button primary" type="submit" disabled={!recorrenciaDisponivel}>{recorrenteEditado ? "Salvar recorrência" : "Cadastrar recorrência"}</button>
          {recorrenteEditado && <Link className="button secondary" href="/eventos#recorrentes">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Prestador</th><th>Instrumento</th><th>Evento</th><th>Valor</th><th>Vigência</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.recorrentes.map((item) => <tr key={item.id}><td><strong>{item.prestadorNome}</strong><small>Matrícula {item.matricula}</small></td><td>Termo {item.termoNumero}<small>Meta {item.metaCodigo}</small></td><td><strong>{item.eventoCodigo}</strong><small>{item.eventoDescricao}</small></td><td>{valor(item.valor, item.tipoCalculo)}</td><td>{competencia(item.inicioCompetencia)}<small>até {competencia(item.fimCompetencia)}</small></td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/eventos?editarRecorrente=${item.id}#recorrentes`}><Pencil size={13} /> Editar</Link><Alternar action={alternarEventoRecorrente} id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.recorrentes.length === 0 && <tr><td colSpan={7} className="empty-cell">Nenhum lançamento recorrente encontrado.</td></tr>}
        </tbody></table></div>
      </section>
    </AppShell>
  );
}
