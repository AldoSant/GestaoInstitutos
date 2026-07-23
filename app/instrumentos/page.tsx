import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleDollarSign,
  Database,
  FileText,
  Pencil,
  Power,
  Search,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarInstrumentos } from "@/db/instrumentos";
import { alternarInstrumento, salvarMeta, salvarTermo } from "./actions";

export const metadata: Metadata = { title: "Termos e metas" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  busca?: string | string[];
  editar?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function moeda(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function data(value: string | null) {
  if (!value) return "Sem término";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function AcaoSituacao({
  entidade,
  id,
  ativo,
}: {
  entidade: "termo" | "meta";
  id: string;
  ativo: boolean;
}) {
  return (
    <form action={alternarInstrumento}>
      <input type="hidden" name="entidade" value={entidade} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button className="row-text-action" type="submit">
        <Power size={13} /> {ativo ? "Inativar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function InstrumentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const busca = primeiro(params.busca).trim();
  const editar = primeiro(params.editar);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);

  let dados: Awaited<ReturnType<typeof carregarInstrumentos>>;
  try {
    dados = await carregarInstrumentos(busca);
  } catch (error) {
    return (
      <AppShell
        title="Termos e metas"
        eyebrow="PostgreSQL"
        organization="Não configurada"
        notice={{
          label: "Configuração necessária",
          text: "Esta área consulta dados persistidos e requer banco e empresa ativa.",
        }}
      >
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Instrumentos indisponíveis</strong>
            <p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const [editarTipo, editarId] = editar.split(":", 2);
  const termoEditado = editarTipo === "termo"
    ? dados.termos.find((item) => item.id === editarId)
    : null;
  const metaEditada = editarTipo === "meta"
    ? dados.metas.find((item) => item.id === editarId)
    : null;
  const opcoesTermos = dados.opcoesTermos.filter(
    (item) => item.ativo || item.id === metaEditada?.termoId,
  );

  return (
    <AppShell
      title="Termos e metas"
      eyebrow="Instrumentos contratuais"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
      notice={{
        label: "Operacional",
        text: "Termos e metas são gravados no PostgreSQL e formarão a base dos vínculos.",
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
          <span className="section-kicker">Base contratual</span>
          <h2>Instrumentos e seus objetos</h2>
          <p>Metas pertencem a um Termo e não podem ser usadas fora dele.</p>
        </div>
        <form action="/instrumentos" method="get" className="search-field">
          <Search size={17} />
          <label className="sr-only" htmlFor="busca-instrumentos">Buscar termos e metas</label>
          <input id="busca-instrumentos" name="busca" type="search" defaultValue={busca} placeholder="Número, descrição, modalidade ou meta" />
          {busca && <Link href="/instrumentos" aria-label="Limpar busca"><X size={15} /></Link>}
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo dos instrumentos">
        <article className="metric-card"><div className="metric-icon"><FileText size={21} /></div><div className="metric-copy"><span>Termos</span><strong>{dados.totais.termos_total}</strong><small>{dados.totais.termos_ativos} ativos</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><Target size={21} /></div><div className="metric-copy"><span>Metas</span><strong>{dados.totais.metas_total}</strong><small>{dados.totais.metas_ativas} ativas</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><TriangleAlert size={21} /></div><div className="metric-copy"><span>Termos sem meta</span><strong>{dados.totais.termos_sem_meta}</strong><small>não aptos a vínculos</small></div></article>
      </section>

      <section className="panel cadastro-section" id="termos">
        <div className="panel-header"><div><span className="section-kicker">Instrumento</span><h2>{termoEditado ? "Editar termo" : "Novo termo"}</h2><p>Número, modalidade, vigência e limite financeiro.</p></div><StatusBadge tone="info">{dados.termos.length} exibidos</StatusBadge></div>
        <form action={salvarTermo} className="crud-form termo-form">
          <input type="hidden" name="id" value={termoEditado?.id ?? ""} />
          <label><span>Número</span><input name="numero" required maxLength={60} defaultValue={termoEditado?.numero ?? ""} /></label>
          <label className="field-wide"><span>Descrição</span><input name="descricao" required maxLength={255} defaultValue={termoEditado?.descricao ?? ""} /></label>
          <label><span>Modalidade</span><input name="modalidade" required maxLength={80} defaultValue={termoEditado?.modalidade ?? ""} /></label>
          <label><span>Início</span><input name="inicio" type="date" required defaultValue={termoEditado?.inicio ?? ""} /></label>
          <label><span>Fim</span><input name="fim" type="date" defaultValue={termoEditado?.fim ?? ""} /></label>
          <label><span>Valor global</span><input name="valorGlobal" inputMode="decimal" required defaultValue={termoEditado?.valorGlobal ?? ""} /></label>
          <button className="button primary" type="submit">{termoEditado ? "Salvar termo" : "Cadastrar termo"}</button>
          {termoEditado && <Link className="button secondary" href="/instrumentos#termos">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Número</th><th>Descrição</th><th>Modalidade</th><th>Vigência</th><th>Valor global</th><th>Metas</th><th>Vínculos</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.termos.map((item) => <tr key={item.id}><td><strong>{item.numero}</strong></td><td>{item.descricao}</td><td>{item.modalidade}</td><td>{data(item.inicio)} a {data(item.fim)}</td><td>{moeda(item.valorGlobal)}</td><td>{item.metasAtivas} ativas<small>{item.totalMetas} no total</small></td><td>{item.totalVinculos}</td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/instrumentos?editar=termo:${item.id}#termos`}><Pencil size={13} /> Editar</Link><AcaoSituacao entidade="termo" id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.termos.length === 0 && <tr><td colSpan={9} className="empty-cell">Nenhum termo encontrado.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel cadastro-section" id="metas">
        <div className="panel-header"><div><span className="section-kicker">Objeto e orçamento</span><h2>{metaEditada ? "Editar meta" : "Nova meta"}</h2><p>A meta será selecionada no vínculo do prestador.</p></div><StatusBadge tone="info">{dados.metas.length} exibidas</StatusBadge></div>
        <form action={salvarMeta} className="crud-form meta-form">
          <input type="hidden" name="id" value={metaEditada?.id ?? ""} />
          <label className="field-wide"><span>Termo</span><select name="termoId" required defaultValue={metaEditada?.termoId ?? ""}><option value="" disabled>Selecione um termo ativo</option>{opcoesTermos.map((item) => <option key={item.id} value={item.id}>{item.numero} · {item.descricao}{item.ativo ? "" : " · inativo"}</option>)}</select></label>
          <label><span>Código</span><input name="codigo" required maxLength={40} defaultValue={metaEditada?.codigo ?? ""} /></label>
          <label className="field-wide"><span>Descrição</span><input name="descricao" required maxLength={255} defaultValue={metaEditada?.descricao ?? ""} /></label>
          <button className="button primary" type="submit" disabled={opcoesTermos.length === 0}>{metaEditada ? "Salvar meta" : "Cadastrar meta"}</button>
          {metaEditada && <Link className="button secondary" href="/instrumentos#metas">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Termo</th><th>Código</th><th>Descrição</th><th>Vínculos</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.metas.map((item) => <tr key={item.id}><td><strong>{item.termoNumero}</strong><small>{item.termoDescricao}</small></td><td>{item.codigo}</td><td>{item.descricao}</td><td>{item.totalVinculos}</td><td><StatusBadge tone={item.ativo && item.termoAtivo ? "success" : "neutral"}>{item.ativo && item.termoAtivo ? "Ativa" : "Inativa"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/instrumentos?editar=meta:${item.id}#metas`}><Pencil size={13} /> Editar</Link><AcaoSituacao entidade="meta" id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.metas.length === 0 && <tr><td colSpan={6} className="empty-cell">Nenhuma meta encontrada.</td></tr>}
        </tbody></table></div>
        <div className="summary-strip"><span><CircleDollarSign size={13} /> O valor global pertence ao Termo; a distribuição por meta poderá evoluir com a importação do plano de trabalho.</span></div>
      </section>
    </AppShell>
  );
}
