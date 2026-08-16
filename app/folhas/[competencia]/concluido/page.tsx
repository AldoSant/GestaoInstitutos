import Link from "next/link";
import { CheckCircle2, FileText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FolhaJornadaProgresso } from "@/components/folha-jornada-progresso";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { carregarFolha } from "@/db/folhas";

export const dynamic = "force-dynamic";

export default async function FolhaConcluidaPage({ params }: { params: Promise<{ competencia: string }> }) {
  const { competencia: folhaId } = await params;
  const empresa = await resolverEmpresaAtiva();
  const dados = await carregarFolha(empresa.id, folhaId);
  const competencia = dados.folha.competencia.slice(0, 7).split("-").reverse().join("/");
  return <AppShell title="Jornada concluída" eyebrow={`Passo 6 de 6 · ${competencia}`} organization={empresa.nomeFantasia ?? empresa.razaoSocial} actions={<Link className="button secondary" href={`/folhas/${folhaId}/consulta`}><FileText size={16} /> Ver consulta completa</Link>}><FolhaJornadaProgresso etapaAtual={6} concluida /><section className="jornada-card"><CheckCircle2 size={24} /><div><span className="section-kicker">Processamento operacional concluído</span><h2>Folha fechada e encaminhada</h2><p>Os valores e memórias da revisão permanecem congelados. Use a consulta completa para documentos, auditoria, detalhamento de prestadores e eventuais acompanhamentos fiscais.</p></div><div className="jornada-acoes"><Link className="button primary" href="/folhas">Voltar aos processamentos</Link><Link className="button secondary" href={`/folhas/${folhaId}/relatorio`}>Abrir relatório da Folha</Link></div></section></AppShell>;
}
