export interface VotoComOrientacao {
  voto: string; // Sim | Não | Abstenção | Obstrução (voto registrado do deputado)
  orientacao: string | undefined; // da bancada do partido NO DIA DA VOTAÇÃO; undefined = não resolvida/ausente
}

export interface ResultadoAlinhamento {
  alinhados: number;
  total: number;
  fracao: number | null;
  foraDoDenominador: { liberado: number; semOrientacao: number };
}

/**
 * Alinhamento com a orientação da bancada. "Liberado", orientação vazia/ausente e votações em que o
 * deputado não votou saem do denominador (PLANO, seção 6).
 */
export function alinhamento(itens: VotoComOrientacao[]): ResultadoAlinhamento {
  let alinhados = 0;
  let total = 0;
  const fora = { liberado: 0, semOrientacao: 0 };
  for (const i of itens) {
    if (i.orientacao === "Liberado") {
      fora.liberado++;
      continue;
    }
    if (!i.orientacao) {
      fora.semOrientacao++;
      continue;
    }
    total++;
    if (i.voto === i.orientacao) alinhados++;
  }
  return { alinhados, total, fracao: total === 0 ? null : alinhados / total, foraDoDenominador: fora };
}
