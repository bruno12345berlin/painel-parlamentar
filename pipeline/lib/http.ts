import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const USER_AGENT = "PainelParlamentar/0.1 (+https://github.com/bruno12345berlin/painel-parlamentar)";

async function comRetentativa(url: string, init: RequestInit, tentativas = 4): Promise<Response> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(120_000),
      });
      if (r.ok) return r;
      ultimoErro = new Error(`HTTP ${r.status} em ${url}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      ultimoErro = e;
    }
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
  throw ultimoErro;
}

export async function baixarArquivo(url: string, destino: string, tentativas = 4): Promise<void> {
  await mkdir(dirname(destino), { recursive: true });
  const parcial = `${destino}.part`;
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await comRetentativa(url, {});
      if (!r.body) throw new Error(`Sem corpo em ${url}`);
      await pipeline(Readable.fromWeb(r.body as never), createWriteStream(parcial));
      await rename(parcial, destino); // só aparece com o nome final se baixou inteiro
      return;
    } catch (e) {
      ultimoErro = e;
      await rm(parcial, { force: true });
      await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
  throw ultimoErro;
}

export async function baixarJson<T = unknown>(url: string): Promise<T> {
  const r = await comRetentativa(url, { headers: { Accept: "application/json" } });
  return (await r.json()) as T;
}
