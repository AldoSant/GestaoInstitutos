import { BookOpenCheck, CalendarClock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarRegrasFiscais } from "@/db/regras";

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

export default async function ParametrosPage() {
  const empresa = await resolverEmpresaAtiva();
  const regras = await listarRegrasFiscais(empresa.id);
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
    <AppShell title="Parâmetros" eyebrow="Regras e vigências">
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
              <dt>Limite da contribuição</dt>
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
