import { spawn } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

export const USER_AGENT = "PainelParlamentar/0.1 (+https://github.com/bruno12345berlin/painel-parlamentar)";

async function comRetentativa(url: string, init: RequestInit, tentativas = 4): Promise<Response> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(180_000),
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

/**
 * Baixa um arquivo grande com o curl do sistema: ele retoma de onde parou (-C -) e repete em qualquer erro de rede,
 * o que o fetch do Node não faz de forma confiável para arquivos de centenas de MB. Fixa HTTP/1.1: o servidor da Câmara
 * reseta streams HTTP/2 em arquivos grandes. Código 33 (faixa inválida) = o .part já estava completo. Grava em .part e só renomeia ao concluir.
 */
export async function baixarArquivo(url: string, destino: string): Promise<void> {
  await mkdir(dirname(destino), { recursive: true });
  const parcial = `${destino}.part`;
  await new Promise<void>((resolve, reject) => {
    const p = spawn("curl", ["-fsSL", "--http1.1", "--retry", "20", "--retry-delay", "3", "--retry-all-errors", "--connect-timeout", "30", "--speed-limit", "10000", "--speed-time", "60", "-C", "-", "-A", USER_AGENT, "-o", parcial, url], { stdio: ["ignore", "ignore", "inherit"] });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 || code === 33 ? resolve() : reject(new Error(`curl saiu com código ${code} em ${url}`))));
  });
  await rename(parcial, destino);
}

export async function baixarJson<T = unknown>(url: string): Promise<T> {
  const r = await comRetentativa(url, { headers: { Accept: "application/json" } });
  return (await r.json()) as T;
}
