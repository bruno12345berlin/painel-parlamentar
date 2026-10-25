import type { Periodo } from "./exercicio.js";

/** Intervalo de evidência de atividade: um voto (início = fim) ou um mês de despesa. */
export interface Evidencia {
  inicio: string;
  fim: string;
}

const dias = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
const GAP_MAX_DIAS = 60; // recesso parlamentar tem ~45 dias: acima disso, é uma saída e volta
const JANELA_MINIMA_SEM_ATIVIDADE = 31; // janelas curtas sem atividade são mantidas (peso pequeno)

/**
 * O histórico de exercício da Câmara tem lacunas nos dois sentidos (suplente "convocado" sem linha de exercício;
 * exercício declarado de anos sem nenhuma atividade). Corrige usando a atividade registrada como evidência:
 *  1. recorta cada janela declarada ao trecho em que há atividade (do primeiro ao último registro dentro dela;
 *     janela em aberto continua em aberto se a última atividade é recente) e descarta a janela longa sem atividade nenhuma;
 *  2. agrupa a atividade em blocos (intervalo máximo de 60 dias) e acrescenta cada bloco como janela;
 *  3. une janelas sobrepostas ou contíguas.
 */
export function periodosEfetivos(declarados: Periodo[], evidencias: Evidencia[], hoje: string): Periodo[] {
  const ev = [...evidencias].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const fimDe = (p: Periodo) => p.fim ?? hoje;
  const mantidos: Periodo[] = [];
  for (const p of declarados) {
    const dentro = ev.filter((e) => e.inicio <= fimDe(p) && e.fim >= p.inicio);
    if (dentro.length === 0) {
      if (dias(p.inicio, fimDe(p)) <= JANELA_MINIMA_SEM_ATIVIDADE) mantidos.push({ ...p });
      continue;
    }
    const primeiro = dentro[0]!.inicio;
    const ultimo = dentro.reduce((m, e) => (e.fim > m ? e.fim : m), dentro[0]!.fim);
    const inicio = primeiro > p.inicio ? primeiro : p.inicio;
    const emAberto = p.fim === undefined && dias(ultimo, hoje) <= GAP_MAX_DIAS;
    mantidos.push(emAberto ? { inicio } : { inicio, fim: ultimo < fimDe(p) ? ultimo : fimDe(p) });
  }

  const blocos: Periodo[] = [];
  for (const e of ev) {
    const ultimo = blocos.at(-1);
    if (ultimo && dias(ultimo.fim!, e.inicio) <= GAP_MAX_DIAS) {
      if (e.fim > ultimo.fim!) ultimo.fim = e.fim;
    } else blocos.push({ inicio: e.inicio, fim: e.fim });
  }

  const todos = [...mantidos, ...blocos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const unidos: Periodo[] = [];
  for (const p of todos) {
    const ultimo = unidos.at(-1);
    const contiguo = ultimo && (ultimo.fim === undefined || dias(ultimo.fim, p.inicio) <= 1);
    if (!ultimo || !contiguo) {
      unidos.push({ ...p });
      continue;
    }
    if (ultimo.fim === undefined) continue; // já em aberto
    if (p.fim === undefined) delete ultimo.fim;
    else if (p.fim > ultimo.fim) ultimo.fim = p.fim;
  }
  return unidos;
}
