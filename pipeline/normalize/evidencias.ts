import { ANOS, RAW } from "../config.js";
import { lerCsvArquivo, lerCsvDeZip, validarCsv } from "../lib/csv.js";
import type { Evidencia } from "../metrics/evidencia.js";
import * as camara from "../schemas/camara.js";

const INICIO = "2019-02-01";
const ultimoDia = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

/**
 * Atividade registrada de cada deputado: votos nominais do Plenário (um dia) e meses com despesa da cota (o mês inteiro).
 * Serve de evidência para corrigir os períodos de exercício do histórico da Câmara (metrics/evidencia.ts).
 */
export async function carregarEvidenciasCamara(deputados: Set<number>): Promise<Map<number, Evidencia[]>> {
  const por = new Map<number, Map<string, Evidencia>>();
  const add = (id: number, e: Evidencia) => {
    if (e.fim < INICIO) return;
    let m = por.get(id);
    if (!m) por.set(id, (m = new Map()));
    m.set(`${e.inicio}|${e.fim}`, e);
  };
  for (const ano of ANOS) {
    const c = `${RAW}/camara/${ano}`;
    const plen = new Map<string, string>();
    for await (const l of validarCsv(`camara ${ano} votacoes`, lerCsvArquivo(`${c}/votacoes.csv`), camara.COLUNAS.votacoes, 20)) if (l.siglaOrgao === "PLEN") plen.set(l.id!, l.data!.slice(0, 10));
    for await (const l of validarCsv(`camara ${ano} votos`, lerCsvArquivo(`${c}/votos.csv`), camara.COLUNAS.votos, 500)) {
      const data = plen.get(l.idVotacao!);
      const id = Number(l.deputado_id);
      if (data && deputados.has(id)) add(id, { inicio: data, fim: data });
    }
    for await (const l of validarCsv(`camara ${ano} ceap`, lerCsvDeZip(`${c}/ceap.csv.zip`), camara.COLUNAS.ceap, 1000)) {
      if (l.sgUF === "NA" || !l.ideCadastro) continue;
      const id = Number(l.ideCadastro);
      const aa = Number(l.numAno);
      const mm = Number(l.numMes);
      if (deputados.has(id) && aa === ano && Number(l.vlrLiquido) !== 0) add(id, { inicio: `${aa}-${String(mm).padStart(2, "0")}-01`, fim: ultimoDia(aa, mm) });
    }
  }
  return new Map([...por].map(([id, m]) => [id, [...m.values()]]));
}
