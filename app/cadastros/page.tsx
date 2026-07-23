import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Database,
  MapPin,
  Pencil,
  Power,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarCadastrosBase } from "@/db/cadastros";
import {
  alternarCadastro,
  salvarAtividade,
  salvarLotacao,
  salvarPessoa,
} from "./actions";

export const metadata: Metadata = { title: "Cadastros" };
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

function documento(cpf: string | null, cnpj: string | null) {
  if (cpf) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cnpj) {
    return cnpj.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return "Não informado";
}

function decimal(value: string | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

function moeda(value: string | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function AcaoSituacao({
  entidade,
  id,
  ativo,
}: {
  entidade: "pessoa" | "atividade" | "lotacao";
  id: string;
  ativo: boolean;
}) {
  return (
    <form action={alternarCadastro}>
      <input type="hidden" name="entidade" value={entidade} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button className="row-text-action" type="submit">
        <Power size={13} /> {ativo ? "Inativar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function CadastrosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const busca = primeiro(params.busca).trim();
  const editar = primeiro(params.editar);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);

  let dados: Awaited<ReturnType<typeof carregarCadastrosBase>>;
  try {
    dados = await carregarCadastrosBase(busca);
  } catch (error) {
    return (
      <AppShell
        title="Cadastros"
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
            <strong>Cadastros indisponíveis</strong>
            <p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const [editarTipo, editarId] = editar.split(":", 2);
  const pessoaEditada =
    editarTipo === "pessoa" ? dados.pessoas.find((item) => item.id === editarId) : null;
  const atividadeEditada =
    editarTipo === "atividade"
      ? dados.atividades.find((item) => item.id === editarId)
      : null;
  const lotacaoEditada =
    editarTipo === "lotacao" ? dados.lotacoes.find((item) => item.id === editarId) : null;

  return (
    <AppShell
      title="Cadastros"
      eyebrow="Dados persistidos"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
      notice={{
        label: "Operacional",
        text: `Alterações são gravadas no PostgreSQL da organização ${dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}.`,
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
          <span className="section-kicker">Consulta unificada</span>
          <h2>Pessoas, atividades e lotações</h2>
          <p>Registros importados do GIW aparecem com o código de origem.</p>
        </div>
        <form action="/cadastros" method="get" className="search-field">
          <Search size={17} />
          <label className="sr-only" htmlFor="busca-cadastros">Buscar cadastros</label>
          <input
            id="busca-cadastros"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Nome, documento, código ou descrição"
          />
          {busca && <Link href="/cadastros" aria-label="Limpar busca"><X size={15} /></Link>}
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo dos cadastros">
        <article className="metric-card">
          <div className="metric-icon"><UsersRound size={21} /></div>
          <div className="metric-copy"><span>Pessoas</span><strong>{dados.totais.pessoas_total}</strong><small>{dados.totais.pessoas_ativas} ativas</small></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><BriefcaseBusiness size={21} /></div>
          <div className="metric-copy"><span>Atividades</span><strong>{dados.totais.atividades_total}</strong><small>{dados.totais.atividades_ativas} ativas</small></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon amber"><MapPin size={21} /></div>
          <div className="metric-copy"><span>Lotações</span><strong>{dados.totais.lotacoes_total}</strong><small>{dados.totais.lotacoes_ativas} ativas</small></div>
        </article>
      </section>

      <section className="panel cadastro-section" id="pessoas">
        <div className="panel-header">
          <div><span className="section-kicker">Identidade</span><h2>Pessoas</h2><p>Base para prestadores, parceiros e vínculos.</p></div>
          <StatusBadge tone="info">{dados.pessoas.length} exibidas</StatusBadge>
        </div>
        <form action={salvarPessoa} className="crud-form">
          <input type="hidden" name="id" value={pessoaEditada?.id ?? ""} />
          <label><span>Natureza</span><select name="tipo" defaultValue={pessoaEditada?.tipo ?? "FISICA"}><option value="FISICA">Pessoa física</option><option value="JURIDICA">Pessoa jurídica</option></select></label>
          <label className="field-wide"><span>Nome ou razão social</span><input name="nome" required maxLength={180} defaultValue={pessoaEditada?.nome ?? ""} /></label>
          <label><span>CPF ou CNPJ</span><input name="documento" inputMode="numeric" defaultValue={pessoaEditada?.cpf ?? pessoaEditada?.cnpj ?? ""} /></label>
          <button className="button primary" type="submit">{pessoaEditada ? "Salvar pessoa" : "Cadastrar pessoa"}</button>
          {pessoaEditada && <Link className="button secondary" href="/cadastros#pessoas">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Código GIW</th><th>Nome</th><th>Natureza</th><th>Documento</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.pessoas.map((item) => <tr key={item.id}><td>{item.legacyId ?? "Local"}</td><td><strong>{item.nome}</strong></td><td>{item.tipo === "FISICA" ? "Pessoa física" : "Pessoa jurídica"}</td><td>{documento(item.cpf, item.cnpj)}</td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativa" : "Inativa"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/cadastros?editar=pessoa:${item.id}#pessoas`}><Pencil size={13} /> Editar</Link><AcaoSituacao entidade="pessoa" id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.pessoas.length === 0 && <tr><td colSpan={6} className="empty-cell">Nenhuma pessoa encontrada.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel cadastro-section" id="atividades">
        <div className="panel-header"><div><span className="section-kicker">Execução</span><h2>Atividades</h2><p>Funções, carga horária e valor de referência.</p></div><StatusBadge tone="info">{dados.atividades.length} exibidas</StatusBadge></div>
        <form action={salvarAtividade} className="crud-form">
          <input type="hidden" name="id" value={atividadeEditada?.id ?? ""} />
          <label><span>Código</span><input name="codigo" required maxLength={40} defaultValue={atividadeEditada?.codigo ?? ""} /></label>
          <label className="field-wide"><span>Descrição</span><input name="descricao" required maxLength={180} defaultValue={atividadeEditada?.descricao ?? ""} /></label>
          <label><span>Carga horária</span><input name="cargaHoraria" inputMode="decimal" defaultValue={atividadeEditada?.cargaHoraria ?? ""} /></label>
          <label><span>Valor</span><input name="valor" inputMode="decimal" defaultValue={atividadeEditada?.valor ?? ""} /></label>
          <button className="button primary" type="submit">{atividadeEditada ? "Salvar atividade" : "Cadastrar atividade"}</button>
          {atividadeEditada && <Link className="button secondary" href="/cadastros#atividades">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Carga horária</th><th>Valor</th><th>Origem</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.atividades.map((item) => <tr key={item.id}><td><strong>{item.codigo}</strong></td><td>{item.descricao}</td><td>{decimal(item.cargaHoraria)}</td><td>{moeda(item.valor)}</td><td>{item.legacyId ? "GIW" : "Local"}</td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativa" : "Inativa"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/cadastros?editar=atividade:${item.id}#atividades`}><Pencil size={13} /> Editar</Link><AcaoSituacao entidade="atividade" id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.atividades.length === 0 && <tr><td colSpan={7} className="empty-cell">Nenhuma atividade encontrada.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel cadastro-section" id="lotacoes">
        <div className="panel-header"><div><span className="section-kicker">Organização</span><h2>Lotações</h2><p>Unidades e locais usados nos vínculos.</p></div><StatusBadge tone="info">{dados.lotacoes.length} exibidas</StatusBadge></div>
        <form action={salvarLotacao} className="crud-form">
          <input type="hidden" name="id" value={lotacaoEditada?.id ?? ""} />
          <label><span>Código</span><input name="codigo" required maxLength={40} defaultValue={lotacaoEditada?.codigo ?? ""} /></label>
          <label className="field-wide"><span>Descrição</span><input name="descricao" required maxLength={160} defaultValue={lotacaoEditada?.descricao ?? ""} /></label>
          <button className="button primary" type="submit">{lotacaoEditada ? "Salvar lotação" : "Cadastrar lotação"}</button>
          {lotacaoEditada && <Link className="button secondary" href="/cadastros#lotacoes">Cancelar</Link>}
        </form>
        <div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Origem</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
          {dados.lotacoes.map((item) => <tr key={item.id}><td><strong>{item.codigo}</strong></td><td>{item.descricao}</td><td>{item.legacyId ? "GIW" : "Local"}</td><td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativa" : "Inativa"}</StatusBadge></td><td><div className="row-actions"><Link className="row-text-action" href={`/cadastros?editar=lotacao:${item.id}#lotacoes`}><Pencil size={13} /> Editar</Link><AcaoSituacao entidade="lotacao" id={item.id} ativo={item.ativo} /></div></td></tr>)}
          {dados.lotacoes.length === 0 && <tr><td colSpan={5} className="empty-cell">Nenhuma lotação encontrada.</td></tr>}
        </tbody></table></div>
      </section>
    </AppShell>
  );
}
