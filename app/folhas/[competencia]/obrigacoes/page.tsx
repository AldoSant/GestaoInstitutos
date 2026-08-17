import Link from "next/link";
import { CheckCircle2, FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BloqueioOrientado } from "@/components/bloqueio-orientado";
import { FolhaJornadaProgresso } from "@/components/folha-jornada-progresso";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";
import { diagnosticarCompetenciaObrigacao, listarObrigacoes } from "@/db/obrigacoes";
import { orientarBloqueio } from "@/lib/bloqueios-orientados";
import { apurarObrigacaoDaJornada } from "../../actions";

export const dynamic = "force-dynamic";

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function moeda(valor: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor));
}

export default async function ObrigacoesDaFolhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ competencia: string }>;
  searchParams: Promise<{ erro?: string | string[]; sucesso?: string | string[] }>;
}) {
  const { competencia: folhaId } = await params;
  const query = await searchParams;
  const empresa = await resolverEmpresaAtiva();
  const folhaDados = await carregarFolha(empresa.id, folhaId);
  const competencia = folhaDados.folha.competencia.slice(0, 7);
  const [diagnostico, obrigacoes] = await Promise.all([
    diagnosticarCompetenciaObrigacao(empresa.id, competencia),
    listarObrigacoes(empresa.id, competencia),
  ]);
  const obrigacao = obrigacoes.find((item) => item.status !== "CANCELADA");
  const usaGps = obrigacao?.perfil_instrumento === "GPS_EXCECAO";
  const gpsPendente = usaGps && (obrigacao.gps_registradas < obrigacao.gps_individuais);
  const erro = primeiro(query.erro);
  const sucesso = primeiro(query.sucesso);

  return (
    <AppShell
      title="Obrigações da competência"
      eyebrow={`Passo 5 de 6 · ${competencia.split("-").reverse().join("/")}`}
      organization={empresa.nomeFantasia ?? empresa.razaoSocial}
      actions={<Link className="button secondary" href={`/folhas/${folhaId}/consulta`}><FileText size={16} /> Ver consulta completa</Link>}
    >
      {erro && <BloqueioOrientado bloqueio={orientarBloqueio({ erro, competencia, retorno: `/folhas/${folhaId}/obrigacoes` })} />}
      {sucesso && <section className="feedback-banner success" role="status"><strong>Operação concluída</strong><span>{sucesso}</span></section>}
      <FolhaJornadaProgresso etapaAtual={5} />
      <section className="jornada-card quiet-journey-decision">
        <ReceiptText size={24} />
        <div>
          <span className="section-kicker">Previdência de prestadores</span>
          <h2>{obrigacao ? "Conferir a obrigação preparada" : "Preparar a apuração previdenciária"}</h2>
          <p>{obrigacao ? usaGps ? "A competência usa GPS excepcional. Confirme as guias oficiais no canal competente antes de concluir a jornada." : "Esta competência segue a trilha DCTFWeb/DARF; o sistema preserva a apuração para conferência, sem gerar guia oficial." : "A apuração reúne todas as Folhas fechadas desta competência e preserva as memórias fiscais já congeladas."}</p>
        </div>
        {!diagnostico.apta_apuracao && !obrigacao && <section className="jornada-alerta"><ShieldCheck size={20} /><div><strong>Aguardando todas as Folhas da competência</strong><p>{diagnostico.folhas_pendentes} processamento(s) ainda precisam ser fechados antes da apuração consolidada.</p></div><Link className="button secondary" href="/folhas">Ver processamentos</Link></section>}
        {obrigacao && <dl className="jornada-valores"><div><dt>Folhas incluídas</dt><dd>{obrigacao.folhas}</dd></div><div><dt>Retenção INSS</dt><dd>{moeda(obrigacao.segurado)}</dd></div><div><dt>Total apurado</dt><dd>{moeda(obrigacao.total)}</dd></div><div><dt>{usaGps ? "GPS registradas" : "Instrumento"}</dt><dd>{usaGps ? `${obrigacao.gps_registradas}/${obrigacao.gps_individuais}` : "DCTFWeb"}</dd></div></dl>}
        <div className="jornada-acoes">
          {!obrigacao && diagnostico.apta_apuracao && <form action={apurarObrigacaoDaJornada}><input type="hidden" name="folhaId" value={folhaId} /><input type="hidden" name="competencia" value={competencia} /><button className="button primary" type="submit"><ReceiptText size={16} /> Apurar obrigação</button></form>}
          {obrigacao && usaGps && <Link className="button primary" href={`/obrigacoes/${obrigacao.id}/gps/registro`}><ReceiptText size={16} /> {gpsPendente ? "Registrar GPS oficiais" : "Revisar GPS registradas"}</Link>}
          {obrigacao && !gpsPendente && <Link className="button primary" href={`/folhas/${folhaId}/concluido`}><CheckCircle2 size={16} /> Concluir jornada</Link>}
          {obrigacao && <Link className="button secondary" href={`/obrigacoes?competencia=${competencia}`}>Ver apuração completa</Link>}
        </div>
      </section>
    </AppShell>
  );
}
