import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  Plus,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarEnquadramentos } from "@/db/enquadramentos";
import { listarPerfisRecolhimento } from "@/db/perfis-recolhimento";
import { listarRegrasFiscais } from "@/db/regras";
import { exigirAdministrador } from "@/lib/autorizacao";
import {
  CATALOGO_REGIMES_PREVIDENCIARIOS,
  CENARIOS_PREVIDENCIARIOS,
  nomeRegimePrevidenciario,
} from "@/lib/enquadramento-previdenciario";
import { nomeInstrumentoRecolhimento } from "@/lib/perfil-recolhimento";
import { EnquadramentoForm } from "./enquadramento-form";
import { PerfilRecolhimentoForm } from "./perfil-recolhimento-form";

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
  novo?: string | string[];
  novoPerfil?: string | string[];
  regime?: string | string[];
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
  const publicarNovo = primeiro(params.novo) === "1";
  const publicarPerfil = primeiro(params.novoPerfil) === "1";
  const regimeInicial = primeiro(params.regime);
  const empresa = await resolverEmpresaAtiva();
  const [regras, enquadramentos, perfisRecolhimento] = await Promise.all([
    listarRegrasFiscais(empresa.id),
    listarEnquadramentos(empresa.id),
    listarPerfisRecolhimento(empresa.id),
  ]);
  const regra = regras.find((item) => item.publicada) ?? regras[0];
  const hoje = new Date().toISOString().slice(0, 10);
  const vigente = enquadramentos.find(
    (item) => item.inicio_vigencia <= hoje && item.fim_vigencia >= hoje,
  );
  const perfilVigente = perfisRecolhimento.find(
    (item) => item.inicio_vigencia <= hoje && item.fim_vigencia >= hoje,
  );

  if (!regra) {
    return (
      <AppShell title="Parâmetros fiscais" eyebrow="Regras e vigências">
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
      title="Parâmetros fiscais"
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

      <nav className="consulta-nav" aria-label="Seções dos parâmetros fiscais">
        <a href="#enquadramento-previdenciario">Enquadramento</a>
        <a href="#perfil-recolhimento">Recolhimento</a>
        <a href="#regras-fiscais">Regras fiscais</a>
      </nav>

      <section className="panel cadastro-section social-security-section" id="enquadramento-previdenciario">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Contratante e contribuinte individual</span>
            <h2>Enquadramento previdenciário</h2>
            <p>
              Consulte a situação vigente, compare os cenários suportados e publique
              uma nova vigência somente quando houver mudança comprovada.
            </p>
          </div>
          <Link className="button primary" href="/parametros?novo=1">
            <Plus size={16} /> Publicar nova vigência
          </Link>
        </div>

        <article className={`current-profile ${vigente ? "" : "missing"}`}>
          <div className="current-profile-icon">
            {vigente ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <small>Enquadramento vigente hoje</small>
            <strong>
              {vigente
                ? nomeRegimePrevidenciario(vigente.regime)
                : "Nenhuma vigência cobre a data atual"}
            </strong>
            <p>
              {vigente
                ? `${dataBrasileira(vigente.inicio_vigencia)} a ${dataBrasileira(vigente.fim_vigencia)} · segurado ${percentual(vigente.aliquota_segurado_numerador, vigente.aliquota_segurado_denominador)} · patronal ${percentual(vigente.aliquota_patronal_numerador, vigente.aliquota_patronal_denominador)}`
                : "A folha fica bloqueada até existir um enquadramento publicado para a competência."}
            </p>
          </div>
          <StatusBadge tone={vigente ? "info" : "warning"}>
            {vigente ? "Vigente" : "Ação necessária"}
          </StatusBadge>
        </article>

        <div className="regime-catalog">
          <div className="subsection-heading">
            <div>
              <h3>Cenários previdenciários</h3>
              <p>As classificações seguem a Tabela 08 do eSocial. Casos com apuração variável aparecem como dependência, não como alíquota fictícia.</p>
            </div>
          </div>
          <div className="regime-catalog-grid">
            {CATALOGO_REGIMES_PREVIDENCIARIOS.map((item) => {
              const cenario = item.publicavel
                ? CENARIOS_PREVIDENCIARIOS[
                    item.regime as keyof typeof CENARIOS_PREVIDENCIARIOS
                  ]
                : null;
              return (
                <article className={`regime-card ${item.publicavel ? "" : "pending"}`} key={item.regime}>
                  <div className="regime-card-heading">
                    <span>eSocial {item.codigoClassificacaoTributaria}</span>
                    <StatusBadge tone={item.publicavel ? "neutral" : "warning"}>
                      {item.publicavel ? "Disponível" : "Módulo adicional"}
                    </StatusBadge>
                  </div>
                  <h4>{item.nome}</h4>
                  <p>{item.resumo}</p>
                  {cenario ? (
                    <>
                      <dl>
                        <div><dt>Segurado</dt><dd>{percentual(cenario.aliquotaSeguradoNumerador, cenario.aliquotaSeguradoDenominador)}</dd></div>
                        <div><dt>Patronal</dt><dd>{percentual(cenario.aliquotaPatronalNumerador, cenario.aliquotaPatronalDenominador)}</dd></div>
                      </dl>
                      <Link className="text-link" href={`/parametros?novo=1&regime=${item.regime}`}>
                        Selecionar este cenário
                      </Link>
                    </>
                  ) : (
                    <small className="dependency-note">{item.motivoIndisponibilidade}</small>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <div className="subsection-heading history-heading">
          <div>
            <h3>Histórico publicado</h3>
            <p>Vigências preservadas para auditoria e reprocessamento.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vigência</th><th>Regime</th><th>Segurado</th><th>Patronal</th><th>CEBAS</th><th>Evidência</th></tr></thead>
            <tbody>
              {enquadramentos.map((item) => (
                <tr key={item.id}>
                  <td><strong>{dataBrasileira(item.inicio_vigencia)}</strong><small>até {dataBrasileira(item.fim_vigencia)}</small></td>
                  <td><StatusBadge tone={item.regime === "BENEFICENTE_IMUNE" ? "info" : "neutral"}>{nomeRegimePrevidenciario(item.regime)}</StatusBadge></td>
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

      <section className="panel cadastro-section" id="perfil-recolhimento">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Emissão e conferência</span>
            <h2>Instrumento de recolhimento</h2>
            <p>
              Defina por vigência se a obrigação será conferida por DCTFWeb/DARF
              ou, somente quando fundamentado, por GPS excepcional.
            </p>
          </div>
          <Link className="button primary" href="/parametros?novoPerfil=1">
            <Plus size={16} /> Publicar vigência
          </Link>
        </div>
        <article className={`current-profile ${perfilVigente ? "" : "missing"}`}>
          <div className="current-profile-icon">
            {perfilVigente ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
          </div>
          <div>
            <small>Perfil vigente hoje</small>
            <strong>
              {perfilVigente
                ? nomeInstrumentoRecolhimento(perfilVigente.instrumento)
                : "Nenhum instrumento publicado para a data atual"}
            </strong>
            <p>
              {perfilVigente
                ? `${dataBrasileira(perfilVigente.inicio_vigencia)} a ${dataBrasileira(perfilVigente.fim_vigencia)}${perfilVigente.codigo_receita ? ` · código ${perfilVigente.codigo_receita}` : ""}`
                : "A apuração fica bloqueada até a publicação de um perfil fundamentado para a competência."}
            </p>
          </div>
          <StatusBadge tone={perfilVigente ? "info" : "warning"}>
            {perfilVigente ? "Vigente" : "Ação necessária"}
          </StatusBadge>
        </article>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vigência</th><th>Instrumento</th><th>Fundamentação</th><th>Responsável</th></tr></thead>
            <tbody>
              {perfisRecolhimento.map((item) => (
                <tr key={item.id}>
                  <td><strong>{dataBrasileira(item.inicio_vigencia)}</strong><small>até {dataBrasileira(item.fim_vigencia)}</small></td>
                  <td>{nomeInstrumentoRecolhimento(item.instrumento)}<small>{item.codigo_receita ? `Código ${item.codigo_receita}` : "Fluxo padrão"}</small></td>
                  <td>{item.evidencia}</td>
                  <td>{item.responsavel}</td>
                </tr>
              ))}
              {perfisRecolhimento.length === 0 && <tr><td colSpan={4} className="empty-cell">Nenhum perfil de recolhimento publicado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {publicarNovo && <EnquadramentoForm regimeInicial={regimeInicial} />}
      {publicarPerfil && <PerfilRecolhimentoForm />}

      <section className="rule-summary" id="regras-fiscais">
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
