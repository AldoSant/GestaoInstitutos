import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarClock,
  Database,
  Link2,
  Pencil,
  Power,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarVinculos } from "@/db/vinculos";
import { alternarVinculo, salvarVinculo } from "./actions";

export const metadata: Metadata = { title: "Vínculos" };
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
  if (!value) return "sem término";
  const [ano, mes, dia] = value.split("-");
  return `${dia}/${mes}/${ano}`;
}

function AcaoSituacao({ id, ativo }: { id: string; ativo: boolean }) {
  return (
    <form action={alternarVinculo}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button className="row-text-action" type="submit">
        <Power size={13} /> {ativo ? "Inativar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function VinculosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const busca = primeiro(params.busca).trim();
  const editarId = primeiro(params.editar);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);

  let dados: Awaited<ReturnType<typeof carregarVinculos>>;
  try {
    dados = await carregarVinculos(busca);
  } catch (error) {
    return (
      <AppShell
        title="Vínculos"
        eyebrow="PostgreSQL"
        organization="Não configurada"
        notice={{
          label: "Configuração necessária",
          text: "Esta área requer banco migrado, empresa ativa e cadastros-base.",
        }}
      >
        <section className="alert-box danger">
          <Database size={22} />
          <div>
            <strong>Vínculos indisponíveis</strong>
            <p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const editado = dados.vinculos.find((item) => item.id === editarId);
  const podeCadastrar =
    dados.prestadores.length > 0 &&
    dados.instrumentos.length > 0 &&
    dados.atividades.length > 0 &&
    dados.lotacoes.length > 0;

  return (
    <AppShell
      title="Vínculos"
      eyebrow="Cadeia contratual"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
      notice={{
        label: "Operacional",
        text: "Cada vínculo conecta prestador, termo, meta, atividade e lotação antes da folha.",
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
          <span className="section-kicker">Contrato operacional</span>
          <h2>Vínculos dos prestadores</h2>
          <p>Vigência, retribuição e incidências usadas posteriormente no cálculo da folha.</p>
        </div>
        <form action="/vinculos" method="get" className="search-field">
          <Search size={17} />
          <label className="sr-only" htmlFor="busca-vinculos">Buscar vínculos</label>
          <input
            id="busca-vinculos"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Prestador, contrato, termo, meta ou atividade"
          />
          {busca && <Link href="/vinculos" aria-label="Limpar busca"><X size={15} /></Link>}
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo dos vínculos">
        <article className="metric-card"><div className="metric-icon"><Link2 size={21} /></div><div className="metric-copy"><span>Vínculos</span><strong>{dados.totais.total}</strong><small>{dados.totais.ativos} ativos</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><ShieldOff size={21} /></div><div className="metric-copy"><span>Sem retenção INSS</span><strong>{dados.totais.sem_inss}</strong><small>vínculos ativos</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><CalendarClock size={21} /></div><div className="metric-copy"><span>Encerrando</span><strong>{dados.totais.encerrando}</strong><small>nos próximos 30 dias</small></div></article>
      </section>

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Dados contratuais</span>
            <h2>{editado ? "Editar vínculo" : "Novo vínculo"}</h2>
            <p>O sistema valida pertencimento, vigência e sobreposição antes de gravar.</p>
          </div>
          <StatusBadge tone={podeCadastrar ? "success" : "warning"}>
            {podeCadastrar ? "Cadastros prontos" : "Complete os cadastros-base"}
          </StatusBadge>
        </div>

        <form action={salvarVinculo} className="crud-form vinculo-form">
          <input type="hidden" name="id" value={editado?.id ?? ""} />
          <label className="field-wide"><span>Prestador</span><select name="prestadorId" required defaultValue={editado?.prestadorId ?? ""}><option value="" disabled>Selecione um prestador</option>{dados.prestadores.map((item) => <option key={item.id} value={item.id}>{item.nome} · matrícula {item.matricula}</option>)}</select></label>
          <label className="field-wide"><span>Termo e meta</span><select name="instrumento" required defaultValue={editado ? `${editado.termoId}:${editado.metaId}` : ""}><option value="" disabled>Selecione termo e meta</option>{dados.instrumentos.map((item) => <option key={item.metaId} value={`${item.termoId}:${item.metaId}`}>Termo {item.termoNumero} · {item.metaCodigo} — {item.metaDescricao}</option>)}</select></label>
          <label><span>Atividade</span><select name="atividadeId" required defaultValue={editado?.atividadeId ?? ""}><option value="" disabled>Selecione</option>{dados.atividades.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.descricao}</option>)}</select></label>
          <label><span>Lotação</span><select name="lotacaoId" required defaultValue={editado?.lotacaoId ?? ""}><option value="" disabled>Selecione</option>{dados.lotacoes.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.descricao}</option>)}</select></label>
          <label><span>Número do contrato</span><input name="numeroContrato" maxLength={60} defaultValue={editado?.numeroContrato ?? ""} /></label>
          <label><span>Início</span><input name="inicio" type="date" required defaultValue={editado?.inicio ?? ""} /></label>
          <label><span>Término</span><input name="fim" type="date" defaultValue={editado?.fim ?? ""} /></label>
          <label><span>Retribuição</span><input name="valorRetribuicao" inputMode="decimal" required placeholder="0,00" defaultValue={editado?.valorRetribuicao ?? ""} /></label>
          <label><span>Carga horária</span><input name="cargaHoraria" inputMode="decimal" placeholder="Ex.: 200" defaultValue={editado?.cargaHoraria ?? ""} /></label>
          <label className="checkbox-field"><input name="descontaInss" type="checkbox" defaultChecked={editado?.descontaInss ?? true} /><span>Desconta INSS</span></label>
          <label className="checkbox-field"><input name="descontaIrrf" type="checkbox" defaultChecked={editado?.descontaIrrf ?? true} /><span>Desconta IRRF</span></label>
          <button className="button primary" type="submit" disabled={!podeCadastrar}>{editado ? "Salvar vínculo" : "Cadastrar vínculo"}</button>
          {editado && <Link className="button secondary" href="/vinculos">Cancelar</Link>}
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Prestador</th><th>Instrumento</th><th>Atividade / lotação</th><th>Vigência</th><th>Retribuição</th><th>Incidências</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {dados.vinculos.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.prestadorNome}</strong><small>Matrícula {item.matricula}{item.numeroContrato ? ` · contrato ${item.numeroContrato}` : ""}</small></td>
                  <td><strong>Termo {item.termoNumero}</strong><small>{item.metaCodigo} · {item.metaDescricao}</small></td>
                  <td>{item.atividadeDescricao ?? "Atividade não localizada"}<small>{item.lotacaoDescricao ?? "Lotação não localizada"}</small></td>
                  <td>{data(item.inicio)}<small>até {data(item.fim)}</small></td>
                  <td><strong>{moeda(item.valorRetribuicao)}</strong><small>{item.cargaHoraria ? `${item.cargaHoraria} h` : "carga não informada"}</small></td>
                  <td><StatusBadge tone={item.descontaInss ? "info" : "neutral"}>{item.descontaInss ? "INSS" : "Sem INSS"}</StatusBadge><small>{item.descontaIrrf ? "Com IRRF" : "Sem IRRF"}</small></td>
                  <td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</StatusBadge></td>
                  <td><div className="row-actions"><Link className="row-text-action" href={`/vinculos?editar=${item.id}`}><Pencil size={13} /> Editar</Link><AcaoSituacao id={item.id} ativo={item.ativo} /></div></td>
                </tr>
              ))}
              {dados.vinculos.length === 0 && <tr><td colSpan={8} className="empty-cell">Nenhum vínculo encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="summary-strip"><span><BadgeDollarSign size={13} /> Retribuição é a base contratual; lançamentos da folha serão versionados à parte.</span><span>Até 300 resultados por consulta.</span></div>
      </section>
    </AppShell>
  );
}
