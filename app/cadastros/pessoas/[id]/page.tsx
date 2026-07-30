import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Home,
  Power,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { carregarFichaPessoa } from "@/db/cadastros";
import {
  alternarDependente,
  salvarContaPessoa,
  salvarDependente,
  salvarEnderecoPessoa,
  salvarFichaPessoa,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  dependente?: string | string[];
  erro?: string | string[];
  sucesso?: string | string[];
}>;

function primeiro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

function documento(cpf: string | null, cnpj: string | null) {
  if (cpf) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cnpj) {
    return cnpj.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return "Documento não informado";
}

export default async function FichaPessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const erro = primeiro(query.erro);
  const sucesso = primeiro(query.sucesso);
  let dados: Awaited<ReturnType<typeof carregarFichaPessoa>>;
  try {
    dados = await carregarFichaPessoa(id);
  } catch {
    return (
      <AppShell
        title="Ficha da pessoa"
        eyebrow="Cadastros"
        organization="Não configurada"
      >
        <Link href="/cadastros#pessoas" className="back-link">
          <ArrowLeft size={16} /> Voltar aos cadastros
        </Link>
        <section className="alert-box danger">
          <AlertTriangle size={22} />
          <div>
            <strong>Ficha indisponível</strong>
            <p>A pessoa não foi encontrada ou os dados não puderam ser carregados.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const dependenteEditado = dados.dependentes.find(
    (item) => item.id === primeiro(query.dependente),
  );
  const prontidao = Object.values(dados.prontidao);
  const itensProntos = prontidao.filter(Boolean).length;
  const apta = itensProntos === prontidao.length;

  return (
    <AppShell
      title={dados.pessoa.nome}
      eyebrow="Ficha cadastral"
      organization={dados.empresa.nomeFantasia ?? dados.empresa.razaoSocial}
    >
      <Link href="/cadastros#pessoas" className="back-link">
        <ArrowLeft size={16} /> Voltar aos cadastros
      </Link>

      {(erro || sucesso) && (
        <section
          className={`feedback-banner ${erro ? "error" : "success"}`}
          role={erro ? "alert" : "status"}
        >
          <strong>{erro ? "Alteração não concluída" : "Ficha atualizada"}</strong>
          <span>{erro || sucesso}</span>
        </section>
      )}

      <section className="hero-row person-hero">
        <div>
          <p className="section-kicker">
            {dados.pessoa.tipo === "FISICA" ? "Pessoa física" : "Pessoa jurídica"}
          </p>
          <h2>{dados.pessoa.nome}</h2>
          <p>
            {documento(dados.pessoa.cpf, dados.pessoa.cnpj)}
            {dados.prestador?.matricula
              ? ` · Matrícula ${dados.prestador.matricula}`
              : " · Sem matrícula de prestador"}
          </p>
        </div>
        <div className="hero-status">
          <StatusBadge tone={apta ? "success" : "warning"}>
            {apta ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {apta ? "Pronta para operação" : "Ficha incompleta"}
          </StatusBadge>
          <span>
            {itensProntos} de {prontidao.length} controles atendidos
          </span>
        </div>
      </section>

      <section className="readiness-grid" aria-label="Prontidão cadastral">
        {[
          { rotulo: "Documento", pronto: dados.prontidao.documento, href: "#identidade" },
          { rotulo: "Contato", pronto: dados.prontidao.contato, href: "#identidade" },
          { rotulo: "Endereço", pronto: dados.prontidao.endereco, href: "#endereco" },
          { rotulo: "Conta bancária", pronto: dados.prontidao.contaBancaria, href: "#pagamento" },
          {
            rotulo: "Prestador ativo",
            pronto: dados.prontidao.prestador,
            href: dados.prestador
              ? `/prestadores?editar=${dados.prestador.id}`
              : `/prestadores?novo=1&pessoa=${dados.pessoa.id}`,
          },
          {
            rotulo: "Vínculo ativo",
            pronto: dados.prontidao.vinculo,
            href: dados.prestador
              ? `/vinculos?novo=1&prestador=${dados.prestador.id}`
              : `/prestadores?novo=1&pessoa=${dados.pessoa.id}`,
          },
        ].map(({ rotulo, pronto, href }) => (
          <Link
            className={`${pronto ? "ready" : "pending"} readiness-action`}
            href={href}
            key={rotulo}
          >
            {pronto ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <span>{rotulo}</span>
            <small>{pronto ? "Revisar" : "Resolver"}</small>
          </Link>
        ))}
      </section>

      <section className="panel cadastro-section" id="identidade">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Identificação e contato</span>
            <h2>Dados pessoais</h2>
            <p>Informações usadas no cálculo, nos relatórios e nas obrigações.</p>
          </div>
          <UserRound size={22} />
        </div>
        <form action={salvarFichaPessoa} className="crud-form person-form">
          <input type="hidden" name="pessoaId" value={dados.pessoa.id} />
          <h3 className="form-section-heading">Identificação civil</h3>
          <label>
            <span>Natureza</span>
            <select name="tipo" defaultValue={dados.pessoa.tipo}>
              <option value="FISICA">Pessoa física</option>
              <option value="JURIDICA">Pessoa jurídica</option>
            </select>
          </label>
          <label className="field-wide">
            <span>Nome ou razão social</span>
            <input name="nome" required maxLength={180} defaultValue={dados.pessoa.nome} />
          </label>
          <label>
            <span>CPF ou CNPJ</span>
            <input
              name="documento"
              inputMode="numeric"
              defaultValue={dados.pessoa.cpf ?? dados.pessoa.cnpj ?? ""}
            />
          </label>
          <label>
            <span>Nascimento</span>
            <input name="nascimento" type="date" defaultValue={dados.pessoa.nascimento ?? ""} />
          </label>
          <label>
            <span>Sexo</span>
            <select name="sexo" defaultValue={dados.pessoa.sexo ?? ""}>
              <option value="">Não informado</option>
              <option value="FEMININO">Feminino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            <span>RG</span>
            <input name="rg" maxLength={40} defaultValue={dados.pessoa.rg ?? ""} />
          </label>
          <label>
            <span>Órgão emissor</span>
            <input
              name="rgOrgaoEmissor"
              maxLength={10}
              defaultValue={dados.pessoa.rgOrgaoEmissor ?? ""}
            />
          </label>
          <label>
            <span>UF do RG</span>
            <input name="rgUf" maxLength={2} defaultValue={dados.pessoa.rgUf ?? ""} />
          </label>
          <label>
            <span>Emissão do RG</span>
            <input
              name="rgEmissao"
              type="date"
              defaultValue={dados.pessoa.rgEmissao ?? ""}
            />
          </label>
          <label>
            <span>Estado civil</span>
            <input
              name="estadoCivil"
              maxLength={40}
              defaultValue={dados.pessoa.estadoCivil ?? ""}
            />
          </label>
          <label className="field-wide">
            <span>Naturalidade</span>
            <input
              name="naturalidade"
              maxLength={120}
              defaultValue={dados.pessoa.naturalidade ?? ""}
            />
          </label>
          <label>
            <span>Inscrição INSS/NIT</span>
            <input
              name="inscricaoInss"
              maxLength={30}
              defaultValue={dados.pessoa.inscricaoInss ?? ""}
            />
          </label>
          <h3 className="form-section-heading">Informações profissionais</h3>
          <label>
            <span>Conselho profissional</span>
            <input
              name="conselhoTipo"
              maxLength={20}
              placeholder="Ex.: COREN"
              defaultValue={dados.pessoa.conselhoTipo ?? ""}
            />
          </label>
          <label>
            <span>Número do conselho</span>
            <input
              name="conselhoNumero"
              maxLength={20}
              defaultValue={dados.pessoa.conselhoNumero ?? ""}
            />
          </label>
          <label>
            <span>CNH</span>
            <input name="cnh" maxLength={20} defaultValue={dados.pessoa.cnh ?? ""} />
          </label>
          <label>
            <span>Categoria da CNH</span>
            <input
              name="cnhCategoria"
              maxLength={2}
              defaultValue={dados.pessoa.cnhCategoria ?? ""}
            />
          </label>
          <label>
            <span>Validade da CNH</span>
            <input
              name="cnhValidade"
              type="date"
              defaultValue={dados.pessoa.cnhValidade ?? ""}
            />
          </label>
          <label className="checkbox-field">
            <input
              name="aposentado"
              type="checkbox"
              defaultChecked={dados.pessoa.aposentado}
            />
            <span>Aposentado</span>
          </label>
          <h3 className="form-section-heading">Dados empresariais</h3>
          <label className="field-wide">
            <span>Nome fantasia</span>
            <input
              name="nomeFantasia"
              maxLength={180}
              defaultValue={dados.pessoa.nomeFantasia ?? ""}
            />
          </label>
          <label className="field-wide">
            <span>Representante legal</span>
            <input
              name="representanteLegal"
              maxLength={180}
              defaultValue={dados.pessoa.representanteLegal ?? ""}
            />
          </label>
          <label>
            <span>Inscrição municipal</span>
            <input
              name="inscricaoMunicipal"
              maxLength={30}
              defaultValue={dados.pessoa.inscricaoMunicipal ?? ""}
            />
          </label>
          <label>
            <span>Inscrição estadual</span>
            <input
              name="inscricaoEstadual"
              maxLength={30}
              defaultValue={dados.pessoa.inscricaoEstadual ?? ""}
            />
          </label>
          <h3 className="form-section-heading">Contato e papéis</h3>
          <label className="field-wide">
            <span>E-mail</span>
            <input
              name="email"
              type="email"
              maxLength={180}
              defaultValue={dados.pessoa.email ?? ""}
            />
          </label>
          <label>
            <span>Telefone</span>
            <input name="telefone" maxLength={20} defaultValue={dados.pessoa.telefone ?? ""} />
          </label>
          <label>
            <span>Celular</span>
            <input name="celular" maxLength={20} defaultValue={dados.pessoa.celular ?? ""} />
          </label>
          <label>
            <span>Celular alternativo</span>
            <input
              name="celularAlternativo"
              maxLength={20}
              defaultValue={dados.pessoa.celularAlternativo ?? ""}
            />
          </label>
          <fieldset className="field-wide role-fields">
            <legend>Papéis no sistema</legend>
            <label>
              <input
                name="papelPrestador"
                type="checkbox"
                defaultChecked={dados.pessoa.papelPrestador}
              />
              <span>Prestador</span>
            </label>
            <label>
              <input
                name="papelParceiro"
                type="checkbox"
                defaultChecked={dados.pessoa.papelParceiro}
              />
              <span>Parceiro</span>
            </label>
            <label>
              <input
                name="papelFornecedor"
                type="checkbox"
                defaultChecked={dados.pessoa.papelFornecedor}
              />
              <span>Fornecedor</span>
            </label>
          </fieldset>
          <button className="button primary" type="submit">
            Salvar dados pessoais
          </button>
        </form>
      </section>

      <div className="two-column-panels">
        <section className="panel cadastro-section" id="endereco">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Localização</span>
              <h2>Endereço</h2>
            </div>
            <Home size={21} />
          </div>
          <form action={salvarEnderecoPessoa} className="crud-form">
            <input type="hidden" name="pessoaId" value={dados.pessoa.id} />
            <label>
              <span>CEP</span>
              <input name="cep" inputMode="numeric" defaultValue={dados.endereco?.cep ?? ""} />
            </label>
            <label className="field-wide">
              <span>Logradouro</span>
              <input
                name="logradouro"
                maxLength={120}
                defaultValue={dados.endereco?.logradouro ?? ""}
              />
            </label>
            <label>
              <span>Número</span>
              <input name="numero" maxLength={20} defaultValue={dados.endereco?.numero ?? ""} />
            </label>
            <label>
              <span>Bairro</span>
              <input name="bairro" maxLength={100} defaultValue={dados.endereco?.bairro ?? ""} />
            </label>
            <label className="field-wide">
              <span>Município</span>
              <input
                name="municipio"
                maxLength={120}
                defaultValue={dados.endereco?.municipio ?? ""}
              />
            </label>
            <label className="field-wide">
              <span>Complemento</span>
              <input
                name="complemento"
                maxLength={200}
                defaultValue={dados.endereco?.complemento ?? ""}
              />
            </label>
            <label className="field-wide">
              <span>Ponto de referência</span>
              <input
                name="referencia"
                maxLength={200}
                defaultValue={dados.endereco?.referencia ?? ""}
              />
            </label>
            <button className="button primary" type="submit">
              Salvar endereço
            </button>
          </form>
        </section>

        <section className="panel cadastro-section" id="pagamento">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Pagamento</span>
              <h2>Conta bancária</h2>
              <p>Congelada no processamento da folha.</p>
            </div>
            <CreditCard size={21} />
          </div>
          <form action={salvarContaPessoa} className="crud-form">
            <input type="hidden" name="pessoaId" value={dados.pessoa.id} />
            <label>
              <span>Tipo</span>
              <select name="tipo" defaultValue={dados.conta?.tipo ?? "CORRENTE"}>
                <option value="CORRENTE">Conta corrente</option>
                <option value="POUPANCA">Poupança</option>
              </select>
            </label>
            <label className="field-wide">
              <span>Agência / identificação bancária</span>
              <input
                name="agencia"
                required
                maxLength={120}
                defaultValue={dados.conta?.agencia ?? ""}
              />
            </label>
            <label>
              <span>Conta</span>
              <input
                name="numero"
                required
                maxLength={20}
                defaultValue={dados.conta?.numero ?? ""}
              />
            </label>
            <label>
              <span>Dígito</span>
              <input name="digito" maxLength={5} defaultValue={dados.conta?.digito ?? ""} />
            </label>
            <label>
              <span>Variação</span>
              <input
                name="variacao"
                maxLength={5}
                defaultValue={dados.conta?.variacao ?? ""}
              />
            </label>
            <button className="button primary" type="submit">
              Salvar conta
            </button>
          </form>
        </section>
      </div>

      <section className="panel cadastro-section" id="dependentes">
        <div className="panel-header">
          <div>
            <span className="section-kicker">IRRF</span>
            <h2>Dependentes</h2>
            <p>Somente dependentes ativos entram na memória de cálculo.</p>
          </div>
          <StatusBadge tone="info">
            <UsersRound size={14} />
            {dados.dependentes.filter((item) => item.ativo).length} ativo(s)
          </StatusBadge>
        </div>
        <form action={salvarDependente} className="crud-form">
          <input type="hidden" name="pessoaId" value={dados.pessoa.id} />
          <input type="hidden" name="id" value={dependenteEditado?.id ?? ""} />
          <label className="field-wide">
            <span>Nome</span>
            <input
              name="nome"
              required
              maxLength={180}
              defaultValue={dependenteEditado?.nome ?? ""}
            />
          </label>
          <label>
            <span>CPF</span>
            <input
              name="cpf"
              inputMode="numeric"
              defaultValue={dependenteEditado?.cpf ?? ""}
            />
          </label>
          <label>
            <span>Nascimento</span>
            <input
              name="nascimento"
              type="date"
              defaultValue={dependenteEditado?.nascimento ?? ""}
            />
          </label>
          <label>
            <span>Parentesco</span>
            <input
              name="parentesco"
              maxLength={80}
              defaultValue={dependenteEditado?.parentesco ?? ""}
            />
          </label>
          <label className="checkbox-field">
            <input
              name="estudante"
              type="checkbox"
              defaultChecked={dependenteEditado?.estudante ?? false}
            />
            <span>Estudante</span>
          </label>
          <label>
            <span>Baixa do salário-família</span>
            <input
              name="baixaSalarioFamilia"
              type="date"
              defaultValue={dependenteEditado?.baixaSalarioFamilia ?? ""}
            />
          </label>
          <label>
            <span>Baixa do IRRF</span>
            <input
              name="baixaIrrf"
              type="date"
              defaultValue={dependenteEditado?.baixaIrrf ?? ""}
            />
          </label>
          <button className="button primary" type="submit">
            {dependenteEditado ? "Salvar dependente" : "Adicionar dependente"}
          </button>
          {dependenteEditado && (
            <Link className="button secondary" href="#dependentes">
              Cancelar edição
            </Link>
          )}
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Nascimento</th>
                <th>Parentesco</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.dependentes.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nome}</strong>
                    <small>{item.estudante ? "Estudante" : "Não estudante"}</small>
                  </td>
                  <td>{item.cpf ?? "Não informado"}</td>
                  <td>{item.nascimento ?? "Não informada"}</td>
                  <td>{item.parentesco ?? "Não informado"}</td>
                  <td>
                    <StatusBadge tone={item.ativo ? "success" : "neutral"}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link
                        className="row-text-action"
                        href={`?dependente=${item.id}#dependentes`}
                      >
                        Editar
                      </Link>
                      <form action={alternarDependente}>
                        <input type="hidden" name="pessoaId" value={dados.pessoa.id} />
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="ativo" value={String(!item.ativo)} />
                        <button className="row-text-action" type="submit">
                          <Power size={13} />
                          {item.ativo ? "Inativar" : "Ativar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {dados.dependentes.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    Nenhum dependente cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
