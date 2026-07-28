import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Database,
  FileCheck2,
  Link2Off,
  Pencil,
  Power,
  Search,
  ShieldOff,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarOutrasFontes } from "@/db/outras-fontes";
import { carregarPrestadores } from "@/db/prestadores";
import {
  alternarPrestador,
  excluirOutraFonte,
  salvarOutraFonte,
  salvarPrestador,
} from "./actions";

export const metadata: Metadata = { title: "Prestadores" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  busca?: string | string[];
  editar?: string | string[];
  fontes?: string | string[];
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
  return "Documento não informado";
}

function moeda(value: string | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function AcaoSituacao({ id, ativo }: { id: string; ativo: boolean }) {
  return (
    <form action={alternarPrestador}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={String(!ativo)} />
      <button className="row-text-action" type="submit">
        <Power size={13} /> {ativo ? "Inativar" : "Ativar"}
      </button>
    </form>
  );
}

export default async function PrestadoresPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const busca = primeiro(params.busca).trim();
  const editarId = primeiro(params.editar);
  const fontesId = primeiro(params.fontes);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);

  let dados: Awaited<ReturnType<typeof carregarPrestadores>>;
  try {
    dados = await carregarPrestadores(busca);
  } catch (error) {
    return (
      <AppShell
        title="Prestadores"
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
            <strong>Prestadores indisponíveis</strong>
            <p>{error instanceof Error ? error.message : "Não foi possível consultar o banco."}</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const prestadorEditado = dados.prestadores.find((item) => item.id === editarId);
  let outrasFontes: Awaited<ReturnType<typeof carregarOutrasFontes>> | null = null;
  if (fontesId) {
    try {
      outrasFontes = await carregarOutrasFontes(dados.empresa.id, fontesId);
    } catch {
      outrasFontes = null;
    }
  }
  const pessoasDisponiveis = dados.pessoas.filter(
    (item) =>
      (!item.prestadorId || item.prestadorId === prestadorEditado?.id) &&
      (item.ativo || item.id === prestadorEditado?.pessoaId),
  );

  return (
    <AppShell
      title="Prestadores"
      eyebrow="Pessoas e vínculos"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
      notice={{
        label: "Operacional",
        text: "Prestadores são gravados no PostgreSQL; vínculos contratuais serão o próximo elo persistente.",
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
          <span className="section-kicker">Cadastro previdenciário</span>
          <h2>Prestadores da organização</h2>
          <p>Cada pessoa pode possuir um único cadastro de prestador por organização.</p>
        </div>
        <form action="/prestadores" method="get" className="search-field">
          <Search size={17} />
          <label className="sr-only" htmlFor="busca-prestadores">Buscar prestadores</label>
          <input
            id="busca-prestadores"
            name="busca"
            type="search"
            defaultValue={busca}
            placeholder="Nome, documento, matrícula ou NIT"
          />
          {busca && <Link href="/prestadores" aria-label="Limpar busca"><X size={15} /></Link>}
        </form>
      </section>

      <section className="metrics-grid" aria-label="Resumo dos prestadores">
        <article className="metric-card">
          <div className="metric-icon"><UsersRound size={21} /></div>
          <div className="metric-copy"><span>Prestadores</span><strong>{dados.totais.total}</strong><small>{dados.totais.ativos} ativos</small></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><ShieldOff size={21} /></div>
          <div className="metric-copy"><span>Isentos de INSS</span><strong>{dados.totais.isentos_inss}</strong><small>cadastros ativos</small></div>
        </article>
        <article className="metric-card">
          <div className="metric-icon amber"><Link2Off size={21} /></div>
          <div className="metric-copy"><span>Sem vínculo ativo</span><strong>{dados.totais.sem_vinculo}</strong><small>aguardando instrumento</small></div>
        </article>
      </section>

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div><span className="section-kicker">Dados funcionais</span><h2>{prestadorEditado ? "Editar prestador" : "Novo prestador"}</h2><p>A Pessoa deve existir antes de ser promovida a Prestador.</p></div>
          <StatusBadge tone="info">{pessoasDisponiveis.length} pessoas disponíveis</StatusBadge>
        </div>
        <form action={salvarPrestador} className="crud-form prestador-form">
          <input type="hidden" name="id" value={prestadorEditado?.id ?? ""} />
          <label className="field-wide"><span>Pessoa</span><select name="pessoaId" required defaultValue={prestadorEditado?.pessoaId ?? ""}><option value="" disabled>Selecione uma pessoa</option>{pessoasDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.tipo === "FISICA" ? "PF" : "PJ"}{item.ativo ? "" : " · inativa"}</option>)}</select></label>
          <label><span>Matrícula</span><input name="matricula" required maxLength={40} defaultValue={prestadorEditado?.matricula ?? ""} /></label>
          <label><span>NIT / PIS / PASEP</span><input name="nitPisPasep" inputMode="numeric" maxLength={20} defaultValue={prestadorEditado?.nitPisPasep ?? ""} /></label>
          <label><span>Categoria eSocial (obrigatória na Folha)</span><input name="categoriaContribuinte" maxLength={30} placeholder="Ex.: 701" defaultValue={prestadorEditado?.categoriaContribuinte ?? ""} /></label>
          <label className="checkbox-field"><input name="isentoInss" type="checkbox" defaultChecked={prestadorEditado?.isentoInss ?? false} /><span>Isento de retenção de INSS</span></label>
          <button className="button primary" type="submit" disabled={pessoasDisponiveis.length === 0}>{prestadorEditado ? "Salvar prestador" : "Cadastrar prestador"}</button>
          {prestadorEditado && <Link className="button secondary" href="/prestadores">Cancelar</Link>}
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Matrícula</th><th>Prestador</th><th>Documento</th><th>Previdenciário</th><th>Vínculo atual</th><th>Retribuição</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {dados.prestadores.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.matricula}</strong><small>{item.pessoaLegacyId ? `Pessoa GIW ${item.pessoaLegacyId}` : "Cadastro local"}</small></td>
                  <td><strong>{item.nome}</strong><small>{item.tipo === "FISICA" ? "Pessoa física" : "Pessoa jurídica"}</small></td>
                  <td>{documento(item.cpf, item.cnpj)}</td>
                  <td>{item.isentoInss ? <StatusBadge tone="neutral">Isento</StatusBadge> : <StatusBadge tone="info">Retém INSS</StatusBadge>}<small>{item.nitPisPasep ?? "NIT não informado"}</small></td>
                  <td>{item.atividadeAtual ?? "Sem vínculo ativo"}<small>{item.totalVinculos} vínculo(s) no histórico</small></td>
                  <td>{moeda(item.retribuicaoAtual)}</td>
                  <td><StatusBadge tone={item.ativo ? "success" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</StatusBadge></td>
                  <td><div className="row-actions"><Link className="row-text-action" href={`/prestadores?fontes=${item.id}`}><WalletCards size={13} /> Outras fontes</Link><Link className="row-text-action" href={`/prestadores?editar=${item.id}`}><Pencil size={13} /> Editar</Link><AcaoSituacao id={item.id} ativo={item.ativo} /></div></td>
                </tr>
              ))}
              {dados.prestadores.length === 0 && <tr><td colSpan={8} className="empty-cell">Nenhum prestador encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="summary-strip"><span><BadgeCheck size={13} /> Pessoas já associadas não aparecem novamente na seleção.</span><span>Até 200 resultados por consulta.</span></div>
      </section>

      {outrasFontes && (
        <section className="panel cadastro-section">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Teto previdenciário mensal</span>
              <h2>Outras fontes de {outrasFontes.prestador.nome}</h2>
              <p>
                Somente comprovantes verificados reduzem a base residual de INSS
                durante o processamento da Folha.
              </p>
            </div>
            <Link className="button secondary" href="/prestadores">Fechar</Link>
          </div>
          <form action={salvarOutraFonte} className="crud-form">
            <input type="hidden" name="prestadorId" value={outrasFontes.prestador.id} />
            <label><span>Competência</span><input name="competencia" type="month" required /></label>
            <label className="field-wide"><span>Fonte pagadora</span><input name="fontePagadora" required maxLength={180} /></label>
            <label><span>CPF/CNPJ da fonte</span><input name="documentoFonte" inputMode="numeric" required maxLength={18} /></label>
            <label><span>Remuneração</span><input name="remuneracao" inputMode="decimal" required placeholder="0,00" /></label>
            <label><span>Base de contribuição</span><input name="baseContribuicao" inputMode="decimal" required placeholder="0,00" /></label>
            <label><span>Contribuição retida</span><input name="valorContribuicao" inputMode="decimal" required placeholder="0,00" /></label>
            <label className="field-wide"><span>Referência do comprovante</span><input name="documentoReferencia" required maxLength={160} placeholder="Recibo, demonstrativo ou protocolo" /></label>
            <label className="field-wide"><span>Observação</span><textarea name="observacao" maxLength={2000} rows={3} /></label>
            <label className="checkbox-field"><input name="comprovanteVerificado" type="checkbox" /><span>Comprovante conferido</span></label>
            <button className="button primary" type="submit"><FileCheck2 size={16} /> Registrar contribuição</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Competência</th><th>Fonte</th><th>Remuneração</th><th>Base</th><th>Retido</th><th>Comprovante</th><th>Ação</th></tr></thead>
              <tbody>
                {outrasFontes.fontes.map((item) => (
                  <tr key={item.id}>
                    <td>{item.competencia.slice(0, 7).split("-").reverse().join("/")}</td>
                    <td><strong>{item.fonte_pagadora}</strong><small>{documento(item.documento_fonte.length === 11 ? item.documento_fonte : null, item.documento_fonte.length === 14 ? item.documento_fonte : null)}</small></td>
                    <td>{moeda(item.remuneracao)}</td>
                    <td>{moeda(item.base_contribuicao)}</td>
                    <td>{moeda(item.valor_contribuicao)}</td>
                    <td><StatusBadge tone={item.comprovante_verificado ? "success" : "warning"}>{item.comprovante_verificado ? "Verificado" : "Pendente"}</StatusBadge><small>{item.documento_referencia}</small></td>
                    <td>
                      <form action={excluirOutraFonte}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="prestadorId" value={outrasFontes.prestador.id} />
                        <button className="row-text-action danger" type="submit"><Trash2 size={13} /> Remover</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {outrasFontes.fontes.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Nenhuma contribuição de outra fonte registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
