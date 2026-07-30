import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarEnquadramentos } from "@/db/enquadramentos";
import { listarRegrasFiscais } from "@/db/regras";
import { exigirAdministrador } from "@/lib/autorizacao";
import { salvarEnquadramento } from "./actions";

export const dynamic = "force-dynamic";

function moedaCentavos(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor / 100);
}

function percentual(numerador: number, denominador: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 4,
  }).format(numerador / denominador);
}

function dataBrasileira(data: string | null) {
  if (!data) return "Sem término";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${data}T00:00:00Z`),
  );
}

type SearchParams = Promise<{
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

export default async function ParametrosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await exigirAdministrador();
  const params = await searchParams;
  const erro = primeiro(params.erro);
  const sucesso = primeiro(params.sucesso);
  const empresa = await resolverEmpresaAtiva();
  const [regras, enquadramentos] = await Promise.all([
    listarRegrasFiscais(empresa.id),
    listarEnquadramentos(empresa.id),
  ]);
  const regra = regras.find((item) => item.publicada) ?? regras[0];

  if (!regra) {
    return (
      <AppShell title="Parâmetros" eyebrow="Regras e vigências">
        <section className="empty-state">
          <ShieldCheck size={34} />
          <h2>Nenhuma regra fiscal cadastrada</h2>
          <p>
            Execute <code>npm run db:bootstrap:regras</code> antes de processar
            competências.
          </p>
        </section>
      </AppShell>
    );
  }

  const { inss, irrf } = regra.parametros;
  return (
    <AppShell
      title="Parâmetros"
      eyebrow="Regras e vigências"
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
    >
      {(erro || sucesso) && (
        <section className={`feedback-banner ${erro ? "error" : "success"}`} role="status">
          <strong>{erro ? "Parâmetro não publicado" : "Parâmetro publicado"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      {enquadramentos.length === 0 && (
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Processamento de Folha bloqueado</strong>
            <p>
              Confirme se a organização recolhe a cota patronal ou está efetivamente
              em gozo da imunidade beneficente. Não basta ser uma entidade sem fins lucrativos.
            </p>
          </div>
        </section>
      )}

      <section className="panel cadastro-section">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Contratante e contribuinte individual</span>
            <h2>Publicar enquadramento previdenciário</h2>
            <p>
              Regime geral aplica 11% ao segurado e 20% à contratante. Beneficente
              imune aplica 20% ao segurado e exige CEBAS válido para zerar a patronal.
            </p>
          </div>
          <StatusBadge tone="warning">Decisão contábil obrigatória</StatusBadge>
        </div>
        <form action={salvarEnquadramento} className="crud-form">
          <label className="field-wide">
            <span>Regime</span>
            <select name="regime" required defaultValue="">
              <option value="" disabled>Selecione após conferir a documentação</option>
              <option value="EMPRESA_GERAL">Empresa/equiparada — patronal de 20%</option>
              <option value="BENEFICENTE_IMUNE">Beneficente em gozo da imunidade — CEBAS</option>
            </select>
          </label>
          <label><span>Início da vigência</span><input name="inicioVigencia" type="date" required /></label>
          <label><span>Fim da vigência</span><input name="fimVigencia" type="date" required /></label>
          <label><span>Número do CEBAS, se aplicável</span><input name="cebasNumero" maxLength={100} /></label>
          <label><span>Início do CEBAS</span><input name="cebasInicio" type="date" /></label>
          <label><span>Fim do CEBAS</span><input name="cebasFim" type="date" /></label>
          <label className="field-wide">
            <span>Evidência e responsável pela conferência</span>
            <textarea
              name="evidencia"
              rows={4}
              required
              maxLength={2000}
              placeholder="Documento consultado, protocolo/certidão, data e responsável pela validação"
            />
          </label>
          <button className="button primary" type="submit">
            <Landmark size={16} /> Publicar enquadramento
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vigência</th><th>Regime</th><th>Segurado</th><th>Patronal</th><th>CEBAS</th><th>Evidência</th></tr></thead>
            <tbody>
              {enquadramentos.map((item) => (
                <tr key={item.id}>
                  <td><strong>{dataBrasileira(item.inicio_vigencia)}</strong><small>até {dataBrasileira(item.fim_vigencia)}</small></td>
                  <td><StatusBadge tone={item.regime === "BENEFICENTE_IMUNE" ? "info" : "neutral"}>{item.regime === "BENEFICENTE_IMUNE" ? "Beneficente imune" : "Regime geral"}</StatusBadge></td>
                  <td>{percentual(item.aliquota_segurado_numerador, item.aliquota_segurado_denominador)}</td>
                  <td>{percentual(item.aliquota_patronal_numerador, item.aliquota_patronal_denominador)}</td>
                  <td>{item.cebas_numero ?? "Não aplicável"}<small>{item.cebas_fim ? `até ${dataBrasileira(item.cebas_fim)}` : ""}</small></td>
                  <td>{item.evidencia}<small>{item.fonte_normativa}</small></td>
                </tr>
              ))}
              {enquadramentos.length === 0 && <tr><td colSpan={6} className="empty-cell">Nenhum enquadramento publicado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rule-summary">
        <article>
          <ShieldCheck />
          <span>
            <small>Versão selecionada</small>
            <strong>{regra.codigo} v{regra.versao}</strong>
          </span>
          <StatusBadge tone={regra.publicada ? undefined : "warning"}>
            {regra.publicada ? "Publicada" : "Rascunho"}
          </StatusBadge>
        </article>
        <article>
          <CalendarClock />
          <span>
            <small>Vigência</small>
            <strong>
              {dataBrasileira(regra.inicioVigencia)} a{" "}
              {dataBrasileira(regra.fimVigencia)}
            </strong>
          </span>
        </article>
        <article>
          <BookOpenCheck />
          <span>
            <small>Integridade verificada</small>
            <strong>{regra.hashConteudo.slice(0, 16)}…</strong>
          </span>
        </article>
      </section>

      <section className="settings-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Previdência</span>
              <h2>Contribuinte individual</h2>
            </div>
            <StatusBadge tone="info">{regra.inicioVigencia.slice(0, 4)}</StatusBadge>
          </div>
          <dl className="parameter-list">
            <div>
              <dt>Alíquota de retenção</dt>
              <dd>{percentual(inss.aliquotaNumerador, inss.aliquotaDenominador)}</dd>
            </div>
            <div>
              <dt>Teto da base</dt>
              <dd>{moedaCentavos(inss.tetoBaseCentavos)}</dd>
            </div>
            <div>
              <dt>Limite da contribuição na referência de 11%</dt>
              <dd>{moedaCentavos(inss.tetoContribuicaoCentavos)}</dd>
            </div>
            <div>
              <dt>Conciliação por pessoa</dt>
              <dd>Obrigatória</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">IRRF</span>
              <h2>Deduções mensais</h2>
            </div>
            <StatusBadge tone="info">{regra.inicioVigencia.slice(0, 4)}</StatusBadge>
          </div>
          <dl className="parameter-list">
            <div>
              <dt>Desconto simplificado</dt>
              <dd>{moedaCentavos(irrf.descontoSimplificadoCentavos)}</dd>
            </div>
            <div>
              <dt>Dedução por dependente</dt>
              <dd>{moedaCentavos(irrf.deducaoDependenteCentavos)}</dd>
            </div>
            <div>
              <dt>Redução integral</dt>
              <dd>Até {moedaCentavos(irrf.reducao.integralAteCentavos)}</dd>
            </div>
            <div>
              <dt>Redução decrescente</dt>
              <dd>Até {moedaCentavos(irrf.reducao.decrescenteAteCentavos)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Tabela progressiva persistida</span>
            <h2>Faixas mensais de IRRF</h2>
            <p>{regra.fonteNormativa}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Limite superior da base</th>
                <th>Alíquota</th>
                <th>Parcela a deduzir</th>
              </tr>
            </thead>
            <tbody>
              {irrf.faixas.map((faixa, indice) => (
                <tr key={`${faixa.limiteSuperiorCentavos ?? "final"}-${indice}`}>
                  <td>
                    <strong>
                      {faixa.limiteSuperiorCentavos === null
                        ? "Sem limite superior"
                        : moedaCentavos(faixa.limiteSuperiorCentavos)}
                    </strong>
                  </td>
                  <td>
                    {percentual(
                      faixa.aliquotaNumerador,
                      faixa.aliquotaDenominador,
                    )}
                  </td>
                  <td>{moedaCentavos(faixa.parcelaDeduzirCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
