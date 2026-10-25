export interface Periodo {
  inicio: string; // AAAA-MM-DD
  fim?: string; // inclusive; ausente = em aberto
}

export const emExercicio = (data: string, periodos: Periodo[]): boolean =>
  periodos.some((p) => data >= p.inicio && (p.fim === undefined || data <= p.fim));

interface EntradaHistorico {
  dataHora: string;
  situacao: string | null;
}

/**
 * Períodos de exercício de um deputado a partir de /deputados/{id}/historico.
 * Linhas com situacao nula (ex.: troca de partido sem mudança de situação) são ignoradas.
 */
export function periodosCamara(historico: EntradaHistorico[]): Periodo[] {
  const ordenado = historico
    .filter((h) => h.situacao)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const periodos: Periodo[] = [];
  let aberto: Periodo | null = null;
  for (const h of ordenado) {
    const data = h.dataHora.slice(0, 10);
    if (h.situacao === "Exercício") {
      aberto ??= { inicio: data };
      if (!periodos.includes(aberto)) periodos.push(aberto);
    } else if (aberto) {
      aberto.fim = diaAnterior(data);
      aberto = null;
    }
  }
  return periodos;
}

function diaAnterior(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
