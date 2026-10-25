import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import { PROCESSADO } from "./config.js";
import { baixarArquivo } from "./lib/http.js";
import { emLote } from "./lib/limite.js";
import type { Parlamentar } from "./model.js";

// Mesmo tamanho e enquadramento para todos (PLANO, seção 5): 320 x 400, WebP, recorte pelo topo (rostos).
const LARGURA = 320;
const ALTURA = 400;
const ORIGINAIS = "data/fotos";
const SAIDA = "public/fotos";
await mkdir(ORIGINAIS, { recursive: true });
await mkdir(SAIDA, { recursive: true });

const dir = `${PROCESSADO}/agregados/parlamentares`;
const pessoas: Parlamentar[] = [];
for (const f of await readdir(dir)) pessoas.push((JSON.parse(await readFile(`${dir}/${f}`, "utf8")) as { parlamentar: Parlamentar }).parlamentar);

const comFoto = pessoas.filter((p) => p.fotoUrl);
const falhas: string[] = [];
let novas = 0;
await emLote(comFoto, 4, async (p) => {
  const destino = `${SAIDA}/${p.slug}.webp`;
  if (existsSync(destino)) return;
  const original = `${ORIGINAIS}/${p.slug}.img`;
  try {
    if (!existsSync(original)) await baixarArquivo(p.fotoUrl!, original);
    await sharp(original).resize(LARGURA, ALTURA, { fit: "cover", position: "top" }).webp({ quality: 80 }).toFile(destino);
    novas++;
  } catch (e) {
    falhas.push(`${p.slug}: ${(e as Error).message.slice(0, 80)}`);
  }
});
console.log(`${comFoto.length} com URL de foto, ${novas} novas, ${falhas.length} falhas, ${pessoas.length - comFoto.length} sem foto`);
if (falhas.length) console.log(falhas.slice(0, 20).join("\n"));
