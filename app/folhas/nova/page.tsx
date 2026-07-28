import Link from "next/link";
import { ArrowLeft, Database, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { resolverEmpresaAtiva } from "@/db/cadastros";
import { listarOpcoesNovaFolha } from "@/db/folhas";
import { criarNovaFolha } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ erro?: string | string[] }>;

export default async function NovaFolhaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const erro = Array.isArray(params.erro) ? params.erro[0] : params.erro;
  let empresa: Awaited<ReturnType<typeof resolverEmpresaAtiva>>;
  let instrumentos: Awaited<ReturnType<typeof listarOpcoesNovaFolha>>;
  try {
    empresa = await resolverEmpresaAtiva();
    instrumentos = await listarOpcoesNovaFolha(empresa.id);
  } catch (error) {
    return (
      <AppShell title="Nova folha" eyebrow="PostgreSQL" organization="Não configurada">
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        <section className="alert-box danger">
          <Database size={22} />
          <div><strong>Cadastro indisponível</strong><p>{error instanceof Error ? error.message : "Falha ao consultar o banco."}</p></div>
        </section>
      </AppShell>
    );
  }

  return (
      <AppShell
        title="Nova folha"
        eyebrow="Montagem da competência"
        organization={empresa.nomeFantasia ?? empresa.razaoSocial}
        notice={{
          label: "Processamento assíncrono",
          text: "Ao criar, o lote entra na fila persistente e o worker materializa itens, eventos e memória.",
        }}
      >
        <Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link>
        {erro && (
          <section className="feedback-banner error" role="alert">
            <strong>Folha não criada</strong><span>{erro}</span>
          </section>
        )}
        <section className="panel cadastro-section">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Lote mensal</span>
              <h2>Selecionar competência e instrumento</h2>
              <p>Serão incluídos os Vínculos ativos no primeiro dia da competência.</p>
            </div>
            <StatusBadge tone={instrumentos.length ? "success" : "warning"}>
              {instrumentos.length ? `${instrumentos.length} opção(ões)` : "Sem instrumentos"}
            </StatusBadge>
          </div>
          <form action={criarNovaFolha} className="crud-form">
            <label>
              <span>Competência</span>
              <input name="competencia" type="month" required />
            </label>
            <label className="field-wide">
              <span>Termo e Meta</span>
              <select name="instrumento" required defaultValue="">
                <option value="" disabled>Selecione o instrumento</option>
                {instrumentos.map((item) => (
                  <option key={item.meta_id} value={`${item.termo_id}:${item.meta_id}`}>
                    Termo {item.termo_numero} · Meta {item.meta_codigo} — {item.meta_descricao}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit" disabled={!instrumentos.length}>
              <PlayCircle size={16} /> Criar e processar
            </button>
          </form>
        </section>
      </AppShell>
  );
}
