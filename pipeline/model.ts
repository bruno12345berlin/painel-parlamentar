import type { Periodo } from "./metrics/exercicio.js";

export type Casa = "camara" | "senado";

export interface Parlamentar {
  slug: string;
  casa: Casa;
  idOrigem: string;
  nome: string;
  nomeCivil?: string;
  partidoAtual: string | null;
  uf: string;
  fotoUrl?: string; // URL oficial (auditoria); o site usa a cópia local
  fotoLocal?: string;
  emExercicio: boolean;
  legislaturas: number[];
  /** Períodos efetivos em exercício (descontando licenças com suplente, vacância etc.), de 2019-02-01 em diante. */
  exercicio: Periodo[];
  /** Períodos como informados pela fonte, antes da correção por atividade registrada (auditoria). Só na Câmara. */
  exercicioDeclarado?: Periodo[];
  /** Condição no mandato: titular ou suplente. */
  condicao: "titular" | "suplente" | "misto";
  contato?: { email?: string; telefone?: string; redes?: string[] };
  fonteUrl: string;
}

/** Métricas aditivas: somar buckets (ano × legislatura) dá o ano ou a legislatura. */
export interface Metricas {
  mesesExercicio: number;
  gastos: { total: number; lancamentos: number; porCategoria: Record<string, number>; porMes: number[] };
  votacoes: { votou: number; total: number; descontadas: Record<string, number> };
  /** null no Senado (sem orientação de bancada). */
  alinhamento: { alinhados: number; total: number; liberado: number; semOrientacao: number } | null;
  projetos: { principal: Record<string, number>; coautor: Record<string, number> };
}

export const metricasVazias = (comAlinhamento: boolean): Metricas => ({
  mesesExercicio: 0,
  gastos: { total: 0, lancamentos: 0, porCategoria: {}, porMes: Array<number>(12).fill(0) },
  votacoes: { votou: 0, total: 0, descontadas: {} },
  alinhamento: comAlinhamento ? { alinhados: 0, total: 0, liberado: 0, semOrientacao: 0 } : null,
  projetos: { principal: {}, coautor: {} },
});

const somaMapa = (a: Record<string, number>, b: Record<string, number>) => {
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = (r[k] ?? 0) + v;
  return r;
};
const c = (v: number) => Math.round(v * 100) / 100;

export function somar(a: Metricas, b: Metricas): Metricas {
  const cat = somaMapa(a.gastos.porCategoria, b.gastos.porCategoria);
  for (const k of Object.keys(cat)) cat[k] = c(cat[k]!);
  return {
    mesesExercicio: a.mesesExercicio + b.mesesExercicio,
    gastos: { total: c(a.gastos.total + b.gastos.total), lancamentos: a.gastos.lancamentos + b.gastos.lancamentos, porCategoria: cat, porMes: a.gastos.porMes.map((v, i) => c(v + b.gastos.porMes[i]!)) },
    votacoes: { votou: a.votacoes.votou + b.votacoes.votou, total: a.votacoes.total + b.votacoes.total, descontadas: somaMapa(a.votacoes.descontadas, b.votacoes.descontadas) },
    alinhamento: a.alinhamento && b.alinhamento ? { alinhados: a.alinhamento.alinhados + b.alinhamento.alinhados, total: a.alinhamento.total + b.alinhamento.total, liberado: a.alinhamento.liberado + b.alinhamento.liberado, semOrientacao: a.alinhamento.semOrientacao + b.alinhamento.semOrientacao } : (a.alinhamento ?? b.alinhamento),
    projetos: { principal: somaMapa(a.projetos.principal, b.projetos.principal), coautor: somaMapa(a.projetos.coautor, b.projetos.coautor) },
  };
}
