import Link from "next/link";
import { CheckCircle2, ExternalLink, FileCheck2, FileText, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarEspelhoObrigacao, listarGuiasGpsIndividuais } from "@/db/obrigacoes";
import { registrarGuiaGps } from "./actions";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";

export const dynamic = "force-dynamic";

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

function data(valor: string | Date | null) {
  if (!valor) return "—";
  const instante = valor instanceof Date ? valor : new Date(`${valor}T00:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(instante);
}

export default async function RegistroGpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string | string[]; sucesso?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const empresa = await resolverEmpresaAtiva();
  const [dados, guias] = await Promise.all([
    carregarEspelhoObrigacao(empresa.id, id),
    listarGuiasGpsIndividuais(empresa.id, id),
  ]);
  if (dados.obrigacao.perfil_instrumento !== "GPS_EXCECAO") {
    return (
      <AppShell title="GPS individuais" eyebrow="Recolhimento previdenciário">
        <BloqueioOrientado bloqueio={{
          titulo: "Esta obrigação não usa GPS individual",
          causa: "A competência foi configurada com outro instrumento de recolhimento.",
          impacto: "Não há GPS individual a registrar nesta tela.",
          acao: { rotulo: "Voltar às obrigações", href: "/obrigacoes" },
        }} />
      </AppShell>
    );
  }
  const pendentes = guias.filter((guia) => guia.status === "PREPARADA").length;
  const sucesso = primeiro(query.sucesso);
  const erro = primeiro(query.erro);

  return (
    <AppShell
      title="Registrar GPS oficiais"
      eyebrow={`Competência ${dados.obrigacao.competencia.slice(0, 7).split("-").reverse().join("/")}`}
      actions={<><Link className="button secondary" href={`/obrigacoes/${id}/gps`}><FileText size={16} /> Memórias para conferência</Link><Link className="button secondary" href="/obrigacoes">Voltar às obrigações</Link></>}
    >
      {erro && <BloqueioOrientado bloqueio={orientarBloqueio({
        erro,
        competencia: dados.obrigacao.competencia.slice(0, 7),
        retorno: `/obrigacoes/${id}/gps/registro`,
      })} />}
      {sucesso && <section className="alert-box success"><CheckCircle2 size={20} /><div><strong>Registro concluído</strong><p>{sucesso}</p></div></section>}
      <section className="section-card">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Evidência externa</span>
            <h2>Uma GPS por retenção de prestador</h2>
            <p>{pendentes ? `${pendentes} guia(s) aguardam conferência no canal oficial.` : "Todas as GPS desta apuração foram registradas."} O sistema não gera código de barras nem substitui a guia oficial.</p>
          </div>
          <StatusBadge tone={pendentes ? "warning" : "success"}>{pendentes ? `${pendentes} pendente(s)` : "Tudo registrado"}</StatusBadge>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Prestador</th><th>Identificador</th><th>Principal</th><th>Encargos</th><th>Total</th><th>Estado</th><th>Ação</th></tr></thead>
            <tbody>
              {guias.map((guia) => (
                <tr key={guia.id}>
                  <td><strong>{guia.beneficiario_nome}</strong><small>Código {guia.codigo_receita}</small></td>
                  <td>{guia.identificador}</td>
                  <td>{moeda(guia.principal)}</td>
                  <td>{moeda(guia.juros)}<small>multa {moeda(guia.multa)}</small></td>
                  <td><strong>{moeda(guia.total)}</strong></td>
                  <td><StatusBadge tone={guia.status === "REGISTRADA" ? "success" : guia.status === "CANCELADA" ? "neutral" : "warning"}>{guia.status === "REGISTRADA" ? "Registrada" : guia.status === "CANCELADA" ? "Cancelada" : "Preparada"}</StatusBadge>{guia.referencia && <small>{guia.referencia} · {data(guia.emitido_em)}</small>}</td>
                  <td>
                    {guia.status === "PREPARADA" ? (
                      <details>
                        <summary className="button secondary"><ReceiptText size={15} /> Registrar GPS oficial</summary>
                        <form action={registrarGuiaGps} className="crud-form" style={{ marginTop: 12 }}>
                          <input type="hidden" name="guiaId" value={guia.id} />
                          <input type="hidden" name="obrigacaoId" value={id} />
                          <label><span>Referência/número da GPS</span><input name="referencia" required maxLength={160} /></label>
                          <label><span>Data de emissão</span><input name="emitidoEm" type="date" required /></label>
                          <label><span>Juros</span><input name="juros" inputMode="decimal" defaultValue="0,00" /></label>
                          <label><span>Multa</span><input name="multa" inputMode="decimal" defaultValue="0,00" /></label>
                          <label className="field-wide"><span>Localizador do documento oficial</span><input name="localizador" required maxLength={2000} placeholder="Caminho interno, ID do arquivo ou protocolo" /></label>
                          <label className="field-wide"><span>Hash SHA-256, se disponível</span><input name="hashSha256" maxLength={64} /></label>
                          <label className="checkbox-field field-wide"><input name="verificado" type="checkbox" required /><span>Conferi esta GPS no canal oficial e confirmo seus dados.</span></label>
                          <button className="button primary" type="submit"><FileCheck2 size={16} /> Preservar registro</button>
                        </form>
                      </details>
                    ) : (
                      <span className="inline-actions"><FileCheck2 size={15} /> {guia.localizador ?? "Registro preservado"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="alert-box"><ExternalLink size={20} /><div><strong>Tratamento do consolidado</strong><p>O registro individual comprova apenas a retenção do segurado. A contribuição patronal e qualquer outro recolhimento seguem a trilha fiscal aplicável e não são dados como quitados por esta tela.</p></div></section>
    </AppShell>
  );
}
