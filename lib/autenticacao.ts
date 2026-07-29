import { createHash, timingSafeEqual } from "node:crypto";

function variavelObrigatoria(nome: "ADMIN_LOGIN" | "ADMIN_PASSWORD") {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} é obrigatória.`);
  if (nome === "ADMIN_PASSWORD" && valor.length < 12) {
    throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
  }
  return valor;
}

function resumoSeguro(valor: string) {
  return createHash("sha256").update(valor, "utf8").digest();
}

function iguaisEmTempoConstante(recebido: string, esperado: string) {
  return timingSafeEqual(resumoSeguro(recebido), resumoSeguro(esperado));
}

export function verificarCredenciais(login: string, senha: string) {
  const loginEsperado = variavelObrigatoria("ADMIN_LOGIN");
  const senhaEsperada = variavelObrigatoria("ADMIN_PASSWORD");

  const loginValido = iguaisEmTempoConstante(login, loginEsperado);
  const senhaValida = iguaisEmTempoConstante(senha, senhaEsperada);
  return loginValido && senhaValida;
}
