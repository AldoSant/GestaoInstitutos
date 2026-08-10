/**
 * Superfície liberada para a operação atual do Instituto.
 *
 * Os módulos abaixo permanecem no repositório e no banco para preservar
 * histórico e permitir reativação futura, mas não fazem parte da rotina que
 * reproduz o GIW: cadastros, processamento mensal e GPS.
 */
const PREFIXOS_MODULOS_ADORMECIDOS = [
  "/administracao",
  "/demonstrativos",
  "/fechamento-mensal",
  "/fgts",
  "/migracoes",
  "/parametros",
] as const;

export function rotaModuloAdormecida(pathname: string) {
  return PREFIXOS_MODULOS_ADORMECIDOS.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}

export const MODULOS_OPERACIONAIS = Object.freeze({
  inicio: "/",
  cadastros: "/cadastros",
  prestadores: "/prestadores",
  vinculos: "/vinculos",
  termosEMetas: "/termos-e-metas",
  processamentos: "/folhas",
  guiasGps: "/obrigacoes",
  medicoes: "/medicoes",
  eventos: "/eventos",
});
