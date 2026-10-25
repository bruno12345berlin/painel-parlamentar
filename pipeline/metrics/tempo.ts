import { PERIODO_LEGISLATURA } from "../config.js";
import type { Periodo } from "./exercicio.js";

/** Legislatura (56 ou 57) que contém a data; null fora do escopo (antes de 2019-02-01). */
export function legislaturaDe(data: string): number | null {
  for (const [leg, p] of Object.entries(PERIODO_LEGISLATURA)) if (data >= p.inicio && data <= p.fim) return Number(leg);
  return null;
}

/** Legislatura do mês, pela data do primeiro dia (mês de transição vai para a legislatura que o inicia). */
export const legislaturaDoMes = (ano: number, mes: number): number | null => legislaturaDe(`${ano}-${String(mes).padStart(2, "0")}-01`);

const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
const dia = (iso: string) => Number(iso.slice(8, 10));

/**
 * Meses (fracionários) em exercício dentro de [inicio, fim]: soma, mês a mês, dos dias em exercício ÷ dias do mês.
 * Usado como base da cota proporcional e da regra de exercício mínimo para rankings.
 */
export function mesesEmExercicio(periodos: Periodo[], inicio: string, fim: string): number {
  let total = 0;
  let a = Number(inicio.slice(0, 4));
  let m = Number(inicio.slice(5, 7));
  const af = Number(fim.slice(0, 4));
  const mf = Number(fim.slice(5, 7));
  while (a < af || (a === af && m <= mf)) {
    const p0 = `${a}-${String(m).padStart(2, "0")}-01`;
    const n = diasNoMes(a, m);
    const p1 = `${a}-${String(m).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    const ini = p0 > inicio ? p0 : inicio;
    const f = p1 < fim ? p1 : fim;
    let dias = 0;
    for (const p of periodos) {
      const i = p.inicio > ini ? p.inicio : ini;
      const e = (p.fim ?? "9999-12-31") < f ? (p.fim ?? "9999-12-31") : f;
      if (i <= e) dias += dia(e) - dia(i) + 1;
    }
    total += Math.min(dias, n) / n;
    if (++m > 12) {
      m = 1;
      a++;
    }
  }
  return Math.round(total * 1000) / 1000;
}
