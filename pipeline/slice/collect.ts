import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { baixarArquivo, baixarJson } from "../lib/http.js";
import { ANO, DEPUTADO, RAW, SENADOR } from "./alvos.js";

const CAMARA = "https://dadosabertos.camara.leg.br";
const SENADO = "https://legis.senado.leg.br/dadosabertos";
const force = process.argv.includes("--force");

async function arquivo(url: string, destino: string) {
  if (existsSync(destino) && !force) return console.log("já existe:", destino);
  console.log("baixando", url);
  await baixarArquivo(url, destino);
}
async function json(url: string, destino: string) {
  if (existsSync(destino) && !force) return console.log("já existe:", destino);
  console.log("consultando", url);
  await mkdir(RAW + "/camara", { recursive: true });
  await mkdir(RAW + "/senado", { recursive: true });
  await writeFile(destino, JSON.stringify(await baixarJson(url)));
}

const c = `${RAW}/camara`;
const s = `${RAW}/senado`;
await arquivo(`https://www.camara.leg.br/cotas/Ano-${ANO}.csv.zip`, `${c}/ceap-${ANO}.csv.zip`);
for (const n of ["votacoes", "votacoesVotos", "votacoesOrientacoes", "proposicoes", "proposicoesAutores"]) {
  await arquivo(`${CAMARA}/arquivos/${n}/csv/${n}-${ANO}.csv`, `${c}/${n}-${ANO}.csv`);
}
await json(`${CAMARA}/api/v2/deputados/${DEPUTADO.idOrigem}`, `${c}/deputado-${DEPUTADO.idOrigem}.json`);
await json(`${CAMARA}/api/v2/deputados/${DEPUTADO.idOrigem}/historico`, `${c}/historico-${DEPUTADO.idOrigem}.json`);

await arquivo(`https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${ANO}.csv`, `${s}/ceaps-${ANO}.csv`);
// ATENÇÃO: ?ano= filtra pelo ano da MATÉRIA, não da sessão; para o ano das votações usar intervalo de datas.
await json(`${SENADO}/votacao?dataInicio=${ANO}-01-01&dataFim=${ANO}-12-31`, `${s}/votacao-${ANO}.json`);
await json(`${SENADO}/senador/${SENADOR.idOrigem}`, `${s}/senador-${SENADOR.idOrigem}.json`);
await json(`${SENADO}/senador/${SENADOR.idOrigem}/mandatos`, `${s}/mandatos-${SENADOR.idOrigem}.json`);
await json(`${SENADO}/senador/${SENADOR.idOrigem}/licencas`, `${s}/licencas-${SENADOR.idOrigem}.json`);
// /senador/{codigo}/autorias está descontinuado (desativação completa em 01/02/2026): usar /processo.
await json(
  `${SENADO}/processo?codigoParlamentarAutor=${SENADOR.idOrigem}&dataInicioApresentacao=${ANO}-01-01&dataFimApresentacao=${ANO}-12-31`,
  `${s}/processos-${SENADOR.idOrigem}-${ANO}.json`,
);
console.log("coleta concluída");
