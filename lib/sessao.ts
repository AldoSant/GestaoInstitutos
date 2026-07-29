import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSAO = "instituto_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 8 * 60 * 60;

export type Sessao = {
  login: string;
  perfil: "ADMINISTRADOR";
  exp: number;
};

function codificar(valor: string) {
  return Buffer.from(valor).toString("base64url");
}

function segredo() {
  const valor = process.env.AUTH_SECRET;
  if (!valor || Buffer.byteLength(valor) < 32) {
    throw new Error("AUTH_SECRET deve ter pelo menos 32 bytes.");
  }
  return valor;
}

function assinatura(conteudo: string) {
  return createHmac("sha256", segredo()).update(conteudo).digest("base64url");
}

export function criarTokenSessao(
  dados: Omit<Sessao, "exp">,
  agora = Date.now(),
) {
  const sessao: Sessao = {
    ...dados,
    exp: Math.floor(agora / 1000) + DURACAO_SESSAO_SEGUNDOS,
  };
  const conteudo = codificar(JSON.stringify(sessao));
  return `${conteudo}.${assinatura(conteudo)}`;
}

export function lerTokenSessao(token: string | undefined, agora = Date.now()) {
  if (!token) return null;
  const [conteudo, assinaturaRecebida, extra] = token.split(".");
  if (!conteudo || !assinaturaRecebida || extra !== undefined) return null;

  try {
    const recebida = Buffer.from(assinaturaRecebida, "base64url");
    const esperada = Buffer.from(assinatura(conteudo), "base64url");
    if (
      recebida.length !== esperada.length ||
      !timingSafeEqual(recebida, esperada)
    ) {
      return null;
    }
    const sessao = JSON.parse(
      Buffer.from(conteudo, "base64url").toString("utf8"),
    ) as Sessao;
    if (
      !sessao.login ||
      sessao.perfil !== "ADMINISTRADOR" ||
      !Number.isSafeInteger(sessao.exp) ||
      sessao.exp <= Math.floor(agora / 1000)
    ) {
      return null;
    }
    return sessao;
  } catch {
    return null;
  }
}
