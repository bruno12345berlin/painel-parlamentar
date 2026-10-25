const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export const formatarReais = (v: number): string => brl.format(v);
export const formatarPercentual = (fracao: number): string => pct.format(fracao);

/** "2026-10-25" -> "25/10/2026", sem converter fuso (data civil de Brasília). */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Dados com mais de 7 dias são considerados desatualizados (PLANO, seção 6). */
export function dadosDesatualizados(iso: string | null, hoje: Date = new Date()): boolean {
  if (!iso) return false;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const atualizado = Date.UTC(a!, m! - 1, d!);
  const diasPassados = (hoje.getTime() - atualizado) / 86_400_000;
  return diasPassados > 7;
}
