import { emExercicio, type Periodo } from "./exercicio.js";

export interface ResultadoParticipacao {
  votou: number;
  total: number; // denominador
  fracao: number | null; // null quando não há votações no período
  descontadas: Record<string, number>; // o que saiu do denominador, por motivo (auditoria)
}

const resultado = (votou: number, total: number, descontadas: Record<string, number>): ResultadoParticipacao => ({
  votou,
  total,
  fracao: total === 0 ? null : votou / total,
  descontadas,
});

export interface VotacaoNominal {
  id: string;
  data: string;
}

/**
 * Câmara. Denominador: votações NOMINAIS do Plenário ocorridas em exercício, sem aquelas em que presidiu.
 * `votos`: votacaoId -> voto bruto do deputado (ausência de linha = não votou).
 * Obstrução e Abstenção contam como voto registrado; "Artigo 17" (presidiu) não conta em nenhum lado.
 */
export function participacaoCamara(
  votacoes: VotacaoNominal[],
  votos: Map<string, string>,
  exercicio: Periodo[],
): ResultadoParticipacao {
  let votou = 0;
  let total = 0;
  const descontadas = { "fora do exercício": 0, presidiu: 0 };
  for (const v of votacoes) {
    if (!emExercicio(v.data, exercicio)) {
      descontadas["fora do exercício"]++;
      continue;
    }
    const voto = votos.get(v.id);
    if (voto === "Artigo 17") {
      descontadas.presidiu++;
      continue;
    }
    total++;
    if (voto !== undefined) votou++;
  }
  return resultado(votou, total, descontadas);
}

// Siglas de voto do Senado (docs/FONTES.md)
const VOTO_REGISTRADO = new Set(["Sim", "Não", "Abstenção"]);
// Afastamentos formais informados pela própria votação: saem do denominador.
const AFASTAMENTO: Record<string, string> = {
  LS: "licença saúde",
  LP: "licença particular",
  MIS: "missão da Casa",
  AP: "atividade parlamentar",
};
const PRESIDIU = "Presidente (art. 51 RISF)";

/**
 * Senado. `siglasPorVotacao`: uma sigla por votação NOMINAL ABERTA em que o senador consta na lista
 * (suplente em exercício substitui o titular na lista, então quem não consta não estava em exercício).
 */
export function participacaoSenado(siglas: string[]): ResultadoParticipacao {
  let votou = 0;
  let total = 0;
  const descontadas: Record<string, number> = { presidiu: 0 };
  for (const s of siglas) {
    if (s === PRESIDIU) {
      descontadas.presidiu!++;
      continue;
    }
    const motivo = AFASTAMENTO[s];
    if (motivo) {
      descontadas[motivo] = (descontadas[motivo] ?? 0) + 1;
      continue;
    }
    total++;
    if (VOTO_REGISTRADO.has(s)) votou++;
  }
  return resultado(votou, total, descontadas);
}
