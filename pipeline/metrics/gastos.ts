import type { Categoria } from "./categorias.js";

export interface Despesa {
  ano: number;
  mes: number;
  categoria: Categoria;
  fornecedor: string;
  documentoFornecedor: string; // já mascarado
  valorLiquido: number; // pode ser negativo (devoluções, bilhetes de compensação)
}

export interface ResumoGastos {
  total: number;
  porCategoria: Partial<Record<Categoria, number>>;
  porMes: number[]; // índice 0 = janeiro
  maioresFornecedores: { fornecedor: string; documento: string; total: number }[];
}

/** Arredonda para centavos para evitar ruído de ponto flutuante nas somas. */
const c = (v: number) => Math.round(v * 100) / 100;

export function resumirGastos(despesas: Despesa[], topFornecedores = 5): ResumoGastos {
  const porCategoria: Partial<Record<Categoria, number>> = {};
  const porMes = Array<number>(12).fill(0);
  const fornecedores = new Map<string, { fornecedor: string; documento: string; total: number }>();
  let total = 0;
  for (const d of despesas) {
    total += d.valorLiquido;
    porCategoria[d.categoria] = (porCategoria[d.categoria] ?? 0) + d.valorLiquido;
    porMes[d.mes - 1] = (porMes[d.mes - 1] ?? 0) + d.valorLiquido;
    const chave = d.documentoFornecedor || d.fornecedor;
    const f = fornecedores.get(chave) ?? { fornecedor: d.fornecedor, documento: d.documentoFornecedor, total: 0 };
    f.total += d.valorLiquido;
    fornecedores.set(chave, f);
  }
  for (const k of Object.keys(porCategoria) as Categoria[]) porCategoria[k] = c(porCategoria[k]!);
  return {
    total: c(total),
    porCategoria,
    porMes: porMes.map(c),
    maioresFornecedores: [...fornecedores.values()]
      .map((f) => ({ ...f, total: c(f.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topFornecedores),
  };
}
