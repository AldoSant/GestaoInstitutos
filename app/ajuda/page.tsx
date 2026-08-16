import Link from "next/link";
import { ArrowRight, BookOpenCheck, CircleAlert, FileCheck2, Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function AjudaPage() {
  return (
    <AppShell title="Ajuda" eyebrow="Guia rápido">
      <section className="ajuda-hero">
        <div className="ajuda-hero-icon"><BookOpenCheck size={25} /></div>
        <div>
          <span className="section-kicker">Orientação operacional</span>
          <h2>Execute a competência com uma decisão por vez</h2>
          <p>O fluxo da Folha indica o próximo passo. Use este guia apenas para se situar ou destravar uma pendência.</p>
        </div>
        <Link className="button primary" href="/folhas">Abrir folha mensal <ArrowRight size={16} /></Link>
      </section>

      <nav className="consulta-nav" aria-label="Navegação do guia">
        <a href="#roteiro-mensal">Roteiro mensal</a>
        <a href="#bloqueios">Pendências</a>
        <a href="#documentos-oficiais">Documentos oficiais</a>
      </nav>

      <section id="roteiro-mensal" className="panel ajuda-roteiro">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Roteiro mensal</span>
            <h2>Da base ao fechamento</h2>
            <p>Não é necessário abrir todas as telas: avance pela etapa indicada na competência.</p>
          </div>
        </div>
        <ol className="ajuda-passos">
          <li><span>1</span><div><strong>Prepare a base</strong><p>Confira <Link className="text-link" href="/cadastros">pessoas e vínculos</Link> ativos para a competência.</p></div></li>
          <li><span>2</span><div><strong>Inicie a Folha</strong><p>Em <Link className="text-link" href="/folhas">Folha mensal</Link>, crie ou retome a competência e siga a conferência indicada.</p></div></li>
          <li><span>3</span><div><strong>Resolva apenas as pendências</strong><p>Quando solicitado, registre a medição ou o lançamento do vínculo e processe novamente.</p></div></li>
          <li><span>4</span><div><strong>Feche com a memória conferida</strong><p>Revise pessoas, rubricas, descontos e valor líquido antes da confirmação final.</p></div></li>
          <li><span>5</span><div><strong>Conclua obrigações e comprovantes</strong><p>Em <Link className="text-link" href="/obrigacoes">Obrigações e GPS</Link>, confira memórias, documentos e pagamento.</p></div></li>
        </ol>
      </section>

      <section id="bloqueios" className="ajuda-grid">
        <article className="panel ajuda-card">
          <CircleAlert size={21} />
          <div><span className="section-kicker">Quando houver bloqueio</span><h2>Corrija no ponto de origem</h2><p>Leia a pendência, abra o cadastro ou lançamento indicado e retorne à mesma competência. Uma folha fechada só pode ser reaberta com justificativa.</p></div>
        </article>
        <article id="documentos-oficiais" className="panel ajuda-card">
          <FileCheck2 size={21} />
          <div><span className="section-kicker">Documentos oficiais</span><h2>Separe conferência de recolhimento</h2><p>Relatórios internos apoiam a conferência. DARF, DCTFWeb, GFD e documentos oficiais precisam corresponder aos valores da competência antes do pagamento.</p></div>
        </article>
        <article className="panel ajuda-card ajuda-card-link">
          <Landmark size={21} />
          <div><span className="section-kicker">Configuração</span><h2>Uma regra por vigência</h2><p>Enquadramento e recolhimento permanecem auditáveis e fora da rotina recorrente.</p><Link className="text-link" href="/parametros">Ver parâmetros da empresa <ArrowRight size={14} /></Link></div>
        </article>
      </section>
    </AppShell>
  );
}
