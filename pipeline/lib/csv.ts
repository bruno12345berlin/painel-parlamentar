import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { parse } from "csv-parse";

export type Linha = Record<string, string>;

interface Opcoes {
  encoding?: "utf8" | "latin1";
  /** Linhas de metadado antes do cabeçalho (ex.: CEAPS do Senado tem 1). */
  pularLinhas?: number;
}

/** Lê um CSV em streaming (os arquivos têm milhões de linhas). */
export async function* lerCsv(fonte: Readable, opcoes: Opcoes = {}): AsyncGenerator<Linha> {
  const parser = fonte.pipe(
    parse({
      columns: true,
      delimiter: ";",
      bom: true,
      relax_quotes: true,
      skip_empty_lines: true,
      encoding: opcoes.encoding ?? "utf8",
      from_line: 1 + (opcoes.pularLinhas ?? 0),
    }),
  );
  for await (const linha of parser) yield linha as Linha;
}

export const lerCsvArquivo = (caminho: string, opcoes: Opcoes = {}) =>
  lerCsv(createReadStream(caminho), opcoes);

/** Lê o primeiro arquivo de um .zip sem descompactar em disco (usa o `unzip` do sistema). */
export function lerCsvDeZip(caminhoZip: string): AsyncGenerator<Linha> {
  const proc = spawn("unzip", ["-p", caminhoZip], { stdio: ["ignore", "pipe", "inherit"] });
  return lerCsv(proc.stdout);
}

/**
 * Valida o CSV enquanto lê: colunas obrigatórias na primeira linha e número mínimo de linhas ao final.
 * Falha com erro claro (a fonte mudou ou veio truncada); quem chama não grava nada antes de terminar.
 */
export async function* validarCsv(nome: string, linhas: AsyncGenerator<Linha>, colunas: readonly string[], minLinhas: number): AsyncGenerator<Linha> {
  let n = 0;
  for await (const l of linhas) {
    if (n === 0) {
      const faltam = colunas.filter((c) => !(c in l));
      if (faltam.length) throw new Error(`${nome}: colunas ausentes: ${faltam.join(", ")}. A fonte mudou?`);
    }
    n++;
    yield l;
  }
  if (n < minLinhas) throw new Error(`${nome}: só ${n} linhas (mínimo esperado ${minLinhas}). Arquivo truncado?`);
}
