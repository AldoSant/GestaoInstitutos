import { Calculator, CheckCircle2, Gauge, Scale } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarMedicoesMensais } from "@/db/medicoes";
import { lerCompetenciaContexto } from "@/lib/competencia-contexto";
import { salvarMedicao } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  competencia?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

function referencia(item: {
  tipo: string;
  percentual: string | null;
  quantidade: string | null;
  valor_unitario: string | null;
}) {
  if (item.tipo === "PERCENTUAL") return `${item.percentual}% do contrato`;
  if (item.tipo === "QUANTIDADE") {
    return `${item.quantidade} × ${moeda(item.valor_unitario ?? "0")}`;
  }
  return "Valor apurado explícito";
}

export default async function MedicoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const competencia = await lerCompetenciaContexto(params.competencia);
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);
  const empresa = await resolverEmpresaAtiva();
  const dados = await carregarMedicoesMensais(empresa.id, competencia);
  const obrigatorias = dados.vinculos.filter(
    (item) => item.exige_medicao_mensal,
  );
  const pendentes = obrigatorias.filter((item) => !item.possui_medicao);
  const total = dados.medicoes.reduce(
    (soma, item) => soma + Number(item.valor_apurado),
    0,
  );

  return (
    <AppShell
      title="Medições mensais"
      eyebrow="Produtividade e proporcionalização"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      notice={{
        label: "Valor auditável",
        text: "A Folha usa somente a medição da competência, com evidência e responsável congelados na memória.",
      }}
    >
      {(erro || sucesso) && (
        <section className={`feedback-banner ${erro ? "error" : "success"}`} role="status">
          <strong>{erro ? "Medição não registrada" : "Medição registrada"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      <section className="cadastro-toolbar panel">
        <div>
          <span className="section-kicker">Competência operacional</span>
          <h2>Produtividade e valores proporcionais</h2>
          <p>Escolha a fórmula documentada no relatório mensal. Nenhuma proporção é presumida.</p>
        </div>
        <form action="/medicoes" method="get" className="search-field">
          <label htmlFor="competencia-medicao">Competência</label>
          <input id="competencia-medicao" name="competencia" type="month" defaultValue={competencia} />
          <button className="button secondary" type="submit">Carregar</button>
        </form>
      </section>

      <section className="metrics-grid">
        <article className="metric-card"><div className="metric-icon"><Gauge size={21} /></div><div className="metric-copy"><span>Medições</span><strong>{dados.medicoes.length}</strong><small>{competencia}</small></div></article>
        <article className="metric-card"><div className="metric-icon amber"><Scale size={21} /></div><div className="metric-copy"><span>Obrigatórias pendentes</span><strong>{pendentes.length}</strong><small>de {obrigatorias.length}</small></div></article>
        <article className="metric-card"><div className="metric-icon blue"><Calculator size={21} /></div><div className="metric-copy"><span>Total apurado</span><strong>{moeda(String(total))}</strong><small>antes de eventos e retenções</small></div></article>
      </section>

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div><span className="section-kicker">Nova medição</span><h2>Calcular e conferir</h2><p>Salvar novamente o mesmo Vínculo e competência cria uma revisão auditada, enquanto não houver Folha fechada.</p></div>
          <StatusBadge tone={pendentes.length ? "warning" : "success"}>{pendentes.length ? "Há pendências" : "Obrigatórias completas"}</StatusBadge>
        </div>
        <form action={salvarMedicao} className="crud-form vinculo-form">
          <input type="hidden" name="competencia" value={competencia} />
          <label className="field-wide"><span>Vínculo</span><select name="vinculoId" required defaultValue=""><option value="" disabled>Selecione o prestador e contrato</option>{dados.vinculos.map((item) => <option key={item.id} value={item.id}>{item.prestador_nome} · {item.matricula} · Termo {item.termo_numero}/{item.meta_codigo} · {moeda(item.valor_retribuicao)}{item.exige_medicao_mensal ? " · obrigatória" : ""}</option>)}</select></label>
          <label><span>Fórmula</span><select name="tipo" required defaultValue="PERCENTUAL"><option value="PERCENTUAL">Percentual do contrato</option><option value="QUANTIDADE">Quantidade × valor unitário</option><option value="VALOR">Valor apurado explícito</option></select></label>
          <label><span>Percentual</span><input name="percentual" inputMode="decimal" placeholder="Ex.: 87,5000" /></label>
          <label><span>Quantidade</span><input name="quantidade" inputMode="decimal" placeholder="Ex.: 12,5000" /></label>
          <label><span>Valor unitário</span><input name="valorUnitario" inputMode="decimal" placeholder="0,0000" /></label>
          <label><span>Valor explícito</span><input name="valor" inputMode="decimal" placeholder="0,00" /></label>
          <label className="field-wide"><span>Referência da evidência</span><input name="evidenciaReferencia" required minLength={3} maxLength={200} placeholder="Relatório, processo, protocolo ou arquivo conferido" /></label>
          <label className="field-wide"><span>Hash SHA-256 da evidência — opcional</span><input name="evidenciaHash" minLength={64} maxLength={64} placeholder="64 caracteres hexadecimais" /></label>
          <label><span>Responsável pela conferência</span><input name="conferente" required minLength={3} maxLength={160} /></label>
          <label className="field-wide"><span>Observação</span><input name="observacao" maxLength={2000} /></label>
          <button className="button primary" type="submit"><CheckCircle2 size={16} /> Calcular e salvar</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header"><div><span className="section-kicker">Valores conferidos</span><h2>Medições de {competencia}</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prestador</th><th>Instrumento</th><th>Fórmula</th><th>Contrato</th><th>Apurado</th><th>Evidência</th><th>Conferência</th></tr></thead>
            <tbody>
              {dados.medicoes.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.prestador_nome}</strong><small>Matrícula {item.matricula} · {item.atividade}</small></td>
                  <td>Termo {item.termo_numero}<small>Meta {item.meta_codigo}</small></td>
                  <td><StatusBadge tone="info">{item.tipo}</StatusBadge><small>{referencia(item)}</small></td>
                  <td>{moeda(item.valor_contratual)}</td>
                  <td><strong>{moeda(item.valor_apurado)}</strong></td>
                  <td>{item.evidencia_referencia}<small>{item.evidencia_hash ? `SHA-256 ${item.evidencia_hash.slice(0, 12)}…` : "Hash não informado"}</small></td>
                  <td>{item.conferente}<small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.conferida_em))}</small></td>
                </tr>
              ))}
              {dados.medicoes.length === 0 && <tr><td colSpan={7} className="empty-cell">Nenhuma medição nesta competência.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
