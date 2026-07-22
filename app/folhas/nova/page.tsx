import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export default function NovaFolhaPage() {
  return <AppShell title="Nova folha" eyebrow="Montagem da competência"><Link href="/folhas" className="back-link"><ArrowLeft size={16} /> Voltar</Link><section className="empty-state"><Construction size={34} /><h2>Fluxo em construção</h2><p>O próximo incremento conectará termo, meta, vínculos e eventos ao motor de cálculo versionado.</p></section></AppShell>;
}
