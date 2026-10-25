import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ANO_ATUAL, ANOS, CAMARA_API, LEGISLATURAS, RAW, SENADO_API } from "./config.js";
import { lerCsvArquivo, lerCsvDeZip } from "./lib/csv.js";
import { baixarArquivo, baixarJson } from "./lib/http.js";
import { emLote } from "./lib/limite.js";
import * as camara from "./schemas/camara.js";
import * as senado from "./schemas/senado.js";

const force = process.argv.includes("--force");
const refreshFechados = process.argv.includes("--refresh-closed");
const CONCORRENCIA = 4;
const manifesto: Record<string, string> = existsSync(`${RAW}/MANIFEST.json`) ? JSON.parse(await readFile(`${RAW}/MANIFEST.json`, "utf8")) : {};
const hoje = new Date().toISOString().slice(0, 10);
let baixados = 0;

/** Ano atual e anterior sempre; anos fechados só se faltar, no refresh mensal ou com --force. */
const deveBaixar = (ano: number | null, caminho: string, idadeMaxDias?: number): boolean => {
  if (force || !existsSync(caminho)) return true;
  if (idadeMaxDias !== undefined) return (Date.now() - statSync(caminho).mtimeMs) / 86_400_000 > idadeMaxDias;
  if (ano === null) return false;
  // anos recentes mudam: rebaixar, mas não se o arquivo já é de menos de 12 h (reexecução no mesmo dia)
  const recente = (Date.now() - statSync(caminho).mtimeMs) / 3_600_000 < 12;
  return (ano >= ANO_ATUAL - 1 && !recente) || refreshFechados;
};

async function arquivo(ano: number, url: string, destino: string) {
  if (!deveBaixar(ano, destino)) return;
  console.log("baixando", url);
  await baixarArquivo(url, destino);
  manifesto[destino] = hoje;
  baixados++;
}

async function json<T>(url: string, destino: string, validar: { parse(x: unknown): T }, idadeMaxDias?: number): Promise<T> {
  if (!deveBaixar(null, destino, idadeMaxDias ?? 7)) return validar.parse(JSON.parse(await readFile(destino, "utf8")));
  const bruto = await baixarJson(url);
  const valido = validar.parse(bruto); // falha com erro claro antes de gravar
  await writeFile(destino, JSON.stringify(bruto));
  manifesto[destino] = hoje;
  baixados++;
  return valido;
}

// .part com mais de 1 h é resto de execução interrompida: descartar para não retomar sobre dado antigo
const limparParciais = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = `${dir}/${e.name}`;
    if (e.isDirectory()) limparParciais(caminho);
    else if (e.name.endsWith(".part") && Date.now() - statSync(caminho).mtimeMs > 3_600_000) rmSync(caminho);
  }
};
if (existsSync(RAW)) limparParciais(RAW);

for (const sub of ["camara/deputados", "camara/historico", "senado/senadores"]) await mkdir(`${RAW}/${sub}`, { recursive: true });

// ---------------------------------------------------------------- arquivos em lote por ano
for (const ano of ANOS) {
  const c = `${RAW}/camara/${ano}`;
  await mkdir(c, { recursive: true });
  await arquivo(ano, `https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`, `${c}/ceap.csv.zip`);
  for (const [n, destino] of [["votacoes", "votacoes"], ["votacoesVotos", "votos"], ["votacoesOrientacoes", "orientacoes"], ["votacoesObjetos", "objetos"], ["proposicoes", "proposicoes"], ["proposicoesAutores", "autores"]] as const)
    await arquivo(ano, `${CAMARA_API}/arquivos/${n}/csv/${n}-${ano}.csv`, `${c}/${destino}.csv`);

  const s = `${RAW}/senado/${ano}`;
  await mkdir(s, { recursive: true });
  await arquivo(ano, `https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_${ano}.csv`, `${s}/ceaps.csv`);
  // ATENÇÃO: ?ano= filtra pelo ano da MATÉRIA; para o ano da sessão, usar intervalo de datas.
  const fim = ano === ANO_ATUAL ? hoje : `${ano}-12-31`;
  if (deveBaixar(ano, `${s}/votacao.json`)) {
    const v = senado.votacoes.parse(await baixarJson(`${SENADO_API}/votacao?dataInicio=${ano}-01-01&dataFim=${fim}`));
    await writeFile(`${s}/votacao.json`, JSON.stringify(v));
    manifesto[`${s}/votacao.json`] = hoje;
    baixados++;
  }
}

// ---------------------------------------------------------------- Câmara: deputados das legislaturas 56 e 57
const idsDeputados = new Set<number>();
for (const leg of LEGISLATURAS) {
  const lista = await json(`${CAMARA_API}/api/v2/deputados?idLegislatura=${leg}&itens=1000&ordem=ASC&ordenarPor=id`, `${RAW}/camara/lista-${leg}.json`, camara.listaDeputados, 1);
  if (lista.dados.length < 500) throw new Error(`Câmara leg. ${leg}: só ${lista.dados.length} deputados (esperado > 500)`);
  lista.dados.forEach((d) => idsDeputados.add(d.id));
}
// A lista /deputados?idLegislatura= NÃO traz todos os suplentes que exerceram mandato (58 com despesas e 26 com votos
// ficaram de fora em 25/10/2026): completar com todo deputado que aparece em votos ou despesas desde 2019-02.
const naLista = idsDeputados.size;
for (const ano of ANOS) {
  const c = `${RAW}/camara/${ano}`;
  for await (const l of lerCsvArquivo(`${c}/votos.csv`)) if (l.deputado_id) idsDeputados.add(Number(l.deputado_id));
  for await (const l of lerCsvDeZip(`${c}/ceap.csv.zip`)) {
    if (l.sgUF === "NA" || !l.ideCadastro) continue;
    if (`${l.numAno}-${l.numMes!.padStart(2, "0")}` >= "2019-02") idsDeputados.add(Number(l.ideCadastro));
  }
}
console.log(`${idsDeputados.size} deputados (${idsDeputados.size - naLista} além das listas da API)`);
await emLote([...idsDeputados], CONCORRENCIA, async (id) => {
  await json(`${CAMARA_API}/api/v2/deputados/${id}`, `${RAW}/camara/deputados/${id}.json`, camara.deputado);
  await json(`${CAMARA_API}/api/v2/deputados/${id}/historico`, `${RAW}/camara/historico/${id}.json`, camara.historico);
});

// ---------------------------------------------------------------- Senado: senadores das legislaturas 56 e 57
const codigos = new Set<string>();
for (const leg of LEGISLATURAS) {
  const lista = await json(`${SENADO_API}/senador/lista/legislatura/${leg}`, `${RAW}/senado/lista-${leg}.json`, senado.listaLegislatura, 1);
  const p = lista.ListaParlamentarLegislatura.Parlamentares.Parlamentar;
  if (p.length < 80) throw new Error(`Senado leg. ${leg}: só ${p.length} parlamentares (esperado > 80)`);
  p.forEach((x) => codigos.add(x.IdentificacaoParlamentar.CodigoParlamentar));
}
console.log(`${codigos.size} códigos de senador (inclui suplentes que talvez nunca tenham exercido)`);
await emLote([...codigos], CONCORRENCIA, async (cod) => {
  const d = `${RAW}/senado/senadores/${cod}`;
  await json(`${SENADO_API}/senador/${cod}`, `${d}-detalhe.json`, senado.detalhe);
  await json(`${SENADO_API}/senador/${cod}/mandatos`, `${d}-mandatos.json`, senado.mandatos);
});
// Autoria via /processo (o endpoint /senador/{codigo}/autorias foi descontinuado em 01/02/2026), só de quem exerceu.
const exerceu = new Set<string>();
for (const cod of codigos) {
  const m = senado.mandatos.parse(JSON.parse(await readFile(`${RAW}/senado/senadores/${cod}-mandatos.json`, "utf8")));
  const ex = m.MandatoParlamentar.Parlamentar.Mandatos.Mandato.flatMap((x) => x.Exercicios?.Exercicio ?? []);
  if (ex.some((e) => (e.DataFim ?? "9999") >= `${ANOS[0]}-01-01`)) exerceu.add(cod);
}
console.log(`${exerceu.size} senadores com exercício desde ${ANOS[0]}`);
await emLote([...exerceu], CONCORRENCIA, async (cod) => {
  await json(
    `${SENADO_API}/processo?codigoParlamentarAutor=${cod}&dataInicioApresentacao=${ANOS[0]}-01-01&dataFimApresentacao=${ANO_ATUAL}-12-31`,
    `${RAW}/senado/senadores/${cod}-processos.json`,
    senado.processos,
  );
});

await writeFile(`${RAW}/MANIFEST.json`, JSON.stringify(manifesto, null, 1));
console.log(`coleta concluída: ${baixados} arquivos novos ou atualizados`);
