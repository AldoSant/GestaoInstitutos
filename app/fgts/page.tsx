import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  ExternalLink,
  FileInput,
  Landmark,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  CATEGORIAS_FGTS_MVP,
  vencimentoNominalFgtsMensal,
} from "@/lib/fgts";
import { sequenciaMinimaEsocialFgtsMensal } from "@/lib/integracoes/esocial";

const competenciaExemplo = "2026-07";

export default function FgtsPage() {
  const fluxo = sequenciaMinimaEsocialFgtsMensal();

  return (
    <AppShell
      title="FGTS Digital"
      eyebrow="Fundação do fluxo oficial"
      notice={{
        label: "Emissão oficial",
        text:
          "A GFD pagável é emitida no FGTS Digital após a remuneração aceita pelo eSocial. Este sistema não gera uma guia paralela.",
      }}
    >
      <section className="hero-row">
        <div>
          <span className="section-kicker">Prioridade do MVP</span>
          <h2>Folha trabalhista → eSocial → GFD → pagamento</h2>
          <p>
            A integração será construída sobre um provedor substituível. O núcleo
            preservará cálculo, recibos, totalizadores e hashes sem depender de um
            fornecedor específico.
          </p>
        </div>
        <div className="hero-status">
          <span className="status-badge warning">Fundação em andamento</span>
          <small>Vencimento nominal do exemplo</small>
          <strong>{vencimentoNominalFgtsMensal(competenciaExemplo)}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="metric-icon amber"><AlertTriangle size={20} /></span>
          <span className="metric-copy">
            <small>Cenário atual da Folha</small>
            <strong>Categoria 701</strong>
            <span>Autônomo não gera FGTS mensal</span>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><BadgeCheck size={20} /></span>
          <span className="metric-copy">
            <small>Categorias iniciais</small>
            <strong>{Object.keys(CATEGORIAS_FGTS_MVP).join(", ")}</strong>
            <span>Demais cenários permanecem bloqueados</span>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><Send size={20} /></span>
          <span className="metric-copy">
            <small>Transmissão</small>
            <strong>eSocial WS</strong>
            <span>Certificado ICP-Brasil ou provedor contratado</span>
          </span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><Landmark size={20} /></span>
          <span className="metric-copy">
            <small>Documento para pagar</small>
            <strong>GFD oficial</strong>
            <span>Emitida no portal e quitada por Pix</span>
          </span>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Cadeia operacional</span>
              <h2>Controles antes do pagamento</h2>
            </div>
          </div>
          <ol className="check-list">
            {fluxo.map((etapa) => (
              <li key={etapa.fase}>
                <span className="status-badge pending">{etapa.fase}</span>
                <div>
                  <strong>{etapa.eventos.join(", ")}</strong>
                  <p>{etapa.observacao}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel critical-panel">
          <div className="critical-icon"><FileInput size={22} /></div>
          <div>
            <span className="section-kicker">Dados necessários</span>
            <h2>Primeiro teste real</h2>
            <p>
              Precisamos de uma Folha com trabalhador que efetivamente tenha direito
              ao FGTS e da GFD correspondente. A amostra permite mapear rubricas,
              recibos e totalizadores sem confundir prestador autônomo com empregado.
            </p>
            <ul>
              <li>categoria, matrícula, admissão, estabelecimento e lotação;</li>
              <li>rubricas e incidências eSocial/FGTS;</li>
              <li>S-5003, S-5013 e GFD da mesma competência;</li>
              <li>comprovante de pagamento, se disponível.</li>
            </ul>
          </div>
        </article>
      </section>

      <section className="quick-grid">
        <Link
          className="quick-card"
          href="https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital"
          target="_blank"
          rel="noreferrer"
        >
          <Landmark size={22} />
          <span><strong>FGTS Digital oficial</strong><small>Acessar portal e manuais</small></span>
          <ExternalLink size={17} />
        </Link>
        <Link
          className="quick-card"
          href="https://www.gov.br/esocial/pt-br/documentacao-tecnica"
          target="_blank"
          rel="noreferrer"
        >
          <FileInput size={22} />
          <span><strong>Documentação eSocial</strong><small>Leiautes, XSD e Web Service</small></span>
          <ExternalLink size={17} />
        </Link>
      </section>
    </AppShell>
  );
}
