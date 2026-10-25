import tabela from "../../data/manual/bancadas.json" with { type: "json" };

const sem = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const compostas = tabela.compostas as Record<string, string[] | null>;
const apelidos = tabela.apelidos as Record<string, string | null>;
const naoBancada = new Set(tabela.naoBancada);

/** Siglas de partido cobertas por uma linha de orientação; null = linha não usável (ver data/manual/bancadas.json). */
export function partidosDaBancada(siglaBancada: string): string[] | null {
  if (naoBancada.has(siglaBancada)) return null;
  if (siglaBancada in compostas) return compostas[siglaBancada] ?? null;
  const alias = apelidos[siglaBancada.toLowerCase()];
  if (alias === null) return null;
  return [alias ?? siglaBancada];
}

export interface LinhaOrientacao {
  bancada: string;
  orientacao: string;
}

/**
 * Orientação aplicável a um deputado numa votação: a linha cujas siglas incluem o partido dele no dia.
 * Várias linhas candidatas: vale a mais específica (menos partidos); empate entre linhas diferentes = ambíguo (undefined).
 */
export function orientacaoDoPartido(partido: string, linhas: LinhaOrientacao[]): string | undefined {
  const alvo = sem(partido);
  const candidatas = linhas
    .map((l) => ({ l, partidos: partidosDaBancada(l.bancada) }))
    .filter((c): c is { l: LinhaOrientacao; partidos: string[] } => !!c.partidos && c.partidos.some((p) => sem(p) === alvo));
  if (candidatas.length === 0) return undefined;
  const menor = Math.min(...candidatas.map((c) => c.partidos.length));
  const melhores = candidatas.filter((c) => c.partidos.length === menor);
  const valores = new Set(melhores.map((c) => c.l.orientacao));
  return valores.size === 1 ? melhores[0]!.l.orientacao : undefined;
}
