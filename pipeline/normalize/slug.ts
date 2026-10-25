import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { normalizarNome } from "../metrics/documentos.js";

const ARQUIVO = "data/manual/slugs.json";

export const slugificar = (nome: string): string =>
  normalizarNome(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export interface PedidoSlug {
  casa: "camara" | "senado";
  idOrigem: string;
  nome: string;
  uf: string;
}

/**
 * Slugs estáveis: chaveados por casa + idOrigem (nunca por nome) e gravados em data/manual/slugs.json.
 * Um slug publicado nunca muda. Colisão com outro parlamentar: acrescenta a casa; se ainda colidir, o id.
 */
export async function atribuirSlugs(pedidos: PedidoSlug[]): Promise<Map<string, string>> {
  const existentes: Record<string, string> = existsSync(ARQUIVO) ? JSON.parse(await readFile(ARQUIVO, "utf8")) : {};
  const usados = new Set(Object.values(existentes));
  const resultado = new Map<string, string>();
  const ordenados = [...pedidos].sort((a, b) => a.casa.localeCompare(b.casa) || Number(a.idOrigem) - Number(b.idOrigem));
  for (const p of ordenados) {
    const chave = `${p.casa}:${p.idOrigem}`;
    let slug = existentes[chave];
    if (!slug) {
      const base = `${slugificar(p.nome)}-${p.uf.toLowerCase()}`;
      slug = [base, `${base}-${p.casa}`, `${base}-${p.casa}-${p.idOrigem}`].find((s) => !usados.has(s))!;
      existentes[chave] = slug;
      usados.add(slug);
    }
    resultado.set(chave, slug);
  }
  const ordenado = Object.fromEntries(Object.entries(existentes).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(ARQUIVO, JSON.stringify(ordenado, null, 1) + "\n");
  return resultado;
}
