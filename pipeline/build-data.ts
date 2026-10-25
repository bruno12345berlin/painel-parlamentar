import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { ANO_ATUAL, ANOS, LEGISLATURAS, PERIODO_LEGISLATURA, PROCESSADO, RAW } from "./config.js";
import { lerCsvArquivo, lerCsvDeZip, validarCsv } from "./lib/csv.js";
import { alinhamento as calcularAlinhamento, type VotoComOrientacao } from "./metrics/alinhamento.js";
import { orientacaoDoPartido, type LinhaOrientacao } from "./metrics/bancadas.js";
import { categorizar } from "./metrics/categorias.js";
import { chaveNome, mascararDocumento, normalizarNome, tipoFornecedor } from "./metrics/documentos.js";
import { emExercicio } from "./metrics/exercicio.js";
import { participacaoCamara, participacaoSenado } from "./metrics/participacao.js";
import { TIPOS_PROJETO, projetosLegislativos } from "./metrics/projetos.js";
import { legislaturaDe, legislaturaDoMes, mesesEmExercicio } from "./metrics/tempo.js";
import { metricasVazias, somar, type Casa, type Metricas, type Parlamentar } from "./model.js";
import { carregarEvidenciasCamara } from "./normalize/evidencias.js";
import { carregarPessoas, legislaturasDe } from "./normalize/pessoas.js";
import { periodosEfetivos } from "./metrics/evidencia.js";
import { classificarVotacao } from "./normalize/votacao.js";
import * as camara from "./schemas/camara.js";
import * as senado from "./schemas/senado.js";

const t0 = Date.now();
const hoje = new Date().toISOString().slice(0, 10);
const OUT = `${PROCESSADO}.novo`;
const num = (t: string | undefined) => Number((t ?? "0").replace(",", ".")) || 0;
const lerJson = async (p: string) => JSON.parse(await readFile(p, "utf8")) as unknown;

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/agregados/parlamentares`, { recursive: true });
await mkdir(`${OUT}/agregados/rankings`, { recursive: true });
await mkdir(`${OUT}/relatorios`, { recursive: true });

const { pessoas, nomesCeaps } = await carregarPessoas();
console.log(`${pessoas.length} parlamentares (${pessoas.filter((p) => p.casa === "camara").length} deputados, ${pessoas.filter((p) => p.casa === "senado").length} senadores)`);
const deputados = new Map(pessoas.filter((p) => p.casa === "camara").map((p) => [Number(p.idOrigem), p]));

// O histórico de exercício da Câmara tem lacunas nos dois sentidos: corrigir pela atividade registrada.
const evidencias = await carregarEvidenciasCamara(new Set(deputados.keys()));
let ajustados = 0;
for (const p of deputados.values()) {
  p.exercicioDeclarado = p.exercicio;
  p.exercicio = periodosEfetivos(p.exercicio, evidencias.get(Number(p.idOrigem)) ?? [], hoje);
  p.legislaturas = legislaturasDe(p.exercicio);
  if (JSON.stringify(p.exercicio) !== JSON.stringify(p.exercicioDeclarado)) ajustados++;
}
console.log(`exercício corrigido pela atividade em ${ajustados} de ${deputados.size} deputados`);
const senadores = new Map(pessoas.filter((p) => p.casa === "senado").map((p) => [p.idOrigem, p]));

// ---------------------------------------------------------------- buckets (parlamentar × ano × legislatura)
const buckets = new Map<string, Map<string, Metricas>>();
function bucket(p: Parlamentar, ano: number, leg: number): Metricas {
  let m = buckets.get(p.slug);
  if (!m) buckets.set(p.slug, (m = new Map()));
  const chave = `${ano}|${leg}`;
  let b = m.get(chave);
  if (!b) {
    b = metricasVazias(p.casa === "camara");
    const lp = PERIODO_LEGISLATURA[leg]!;
    const ini = `${ano}-01-01` > lp.inicio ? `${ano}-01-01` : lp.inicio;
    const fimAno = ano === ANO_ATUAL ? hoje : `${ano}-12-31`;
    const fim = fimAno < lp.fim ? fimAno : lp.fim;
    b.mesesExercicio = ini <= fim ? mesesEmExercicio(p.exercicio, ini, fim) : 0;
    m.set(chave, b);
  }
  return b;
}

interface DespesaAgregada { mes: number; categoria: string; fornecedor: string; documento: string; tipo: string; valor: number; n: number }
interface DetalheAno {
  despesas: Map<string, DespesaAgregada>;
  votos: [number, string, string | null][]; // [índice na tabela de votações do ano, voto original, orientação]
  projetos: Record<string, unknown>[];
}
const relatorio = { ceapCamaraSemParlamentar: new Map<string, number>(), ceapsSemMatch: new Map<string, number>(), ceapsAmbiguo: new Map<string, number>(), votosSemParlamentar: 0 };

const excecoesCeaps: Record<string, string | null> = existsSync("data/manual/ceaps-nomes.json") ? (JSON.parse(await readFile("data/manual/ceaps-nomes.json", "utf8")) as Record<string, string | null>) : {};
const indiceNomes = new Map<string, string[]>();
for (const [nome, slugs] of nomesCeaps) indiceNomes.set(chaveNome(nome), [...(indiceNomes.get(chaveNome(nome)) ?? []), ...slugs]);
const porSlug = new Map(pessoas.map((p) => [p.slug, p]));

function somarGasto(b: Metricas, mes: number, categoria: string, valor: number) {
  b.gastos.total += valor;
  b.gastos.lancamentos++;
  b.gastos.porCategoria[categoria] = (b.gastos.porCategoria[categoria] ?? 0) + valor;
  b.gastos.porMes[mes - 1] = (b.gastos.porMes[mes - 1] ?? 0) + valor;
}

function adicionarDespesa(d: DetalheAno, a: { mes: number; categoria: string; fornecedor: string; docBruto: string; valor: number }) {
  const documento = mascararDocumento(a.docBruto);
  const chave = `${a.mes}|${a.categoria}|${documento}|${a.fornecedor}`;
  const x = d.despesas.get(chave) ?? { mes: a.mes, categoria: a.categoria, fornecedor: a.fornecedor, documento, tipo: tipoFornecedor(a.docBruto), valor: 0, n: 0 };
  x.valor += a.valor;
  x.n++;
  d.despesas.set(chave, x);
}

function compactarDespesas(m: Map<string, DespesaAgregada>) {
  const fornecedores: { nome: string; documento: string; tipo: string }[] = [];
  const idx = new Map<string, number>();
  const linhas = [...m.values()].map((x) => {
    const k = `${x.documento}|${x.fornecedor}`;
    let i = idx.get(k);
    if (i === undefined) {
      i = fornecedores.push({ nome: x.fornecedor, documento: x.documento, tipo: x.tipo }) - 1;
      idx.set(k, i);
    }
    return [x.mes, x.categoria, i, Math.round(x.valor * 100) / 100, x.n] as const; // [mês, categoria, fornecedor, valor, lançamentos]
  });
  return { fornecedores, despesas: linhas };
}

const tabelasVotacoes: Record<string, unknown[]> = {};
// Votações com mais de 3 proposições vinculadas (apensadas etc.) não têm "a" proposição votada identificável: ficam só com a descrição oficial.
const MAX_OBJETOS = 3;

// ---------------------------------------------------------------- por ano
for (const ano of ANOS) {
  const detalhes = new Map<string, DetalheAno>();
  const detalhe = (p: Parlamentar) => {
    let d = detalhes.get(p.slug);
    if (!d) detalhes.set(p.slug, (d = { despesas: new Map(), votos: [], projetos: [] }));
    return d;
  };
  const c = `${RAW}/camara/${ano}`;

  // ---- Câmara: votações do Plenário
  const plen = new Map<string, { id: string; data: string; descricao: string; aprovacao: string; sim: number; nao: number; outros: number }>();
  for await (const l of validarCsv(`camara ${ano} votacoes`, lerCsvArquivo(`${c}/votacoes.csv`), camara.COLUNAS.votacoes, 20))
    if (l.siglaOrgao === "PLEN") plen.set(l.id!, { id: l.id!, data: l.data!.slice(0, 10), descricao: l.descricao ?? "", aprovacao: l.aprovacao ?? "", sim: num(l.votosSim), nao: num(l.votosNao), outros: num(l.votosOutros) });

  const nominais = new Set<string>();
  const votosPorDep = new Map<number, Map<string, { voto: string; partido: string }>>();
  for await (const l of validarCsv(`camara ${ano} votos`, lerCsvArquivo(`${c}/votos.csv`), camara.COLUNAS.votos, 500)) {
    if (!plen.has(l.idVotacao!)) continue;
    nominais.add(l.idVotacao!);
    const id = Number(l.deputado_id);
    if (!deputados.has(id)) {
      relatorio.votosSemParlamentar++;
      continue;
    }
    let m = votosPorDep.get(id);
    if (!m) votosPorDep.set(id, (m = new Map()));
    m.set(l.idVotacao!, { voto: l.voto!, partido: l.deputado_siglaPartido! });
  }
  const orient = new Map<string, LinhaOrientacao[]>();
  for await (const l of validarCsv(`camara ${ano} orientacoes`, lerCsvArquivo(`${c}/orientacoes.csv`), camara.COLUNAS.orientacoes, 20)) {
    if (!nominais.has(l.idVotacao!)) continue;
    const a = orient.get(l.idVotacao!) ?? [];
    a.push({ bancada: l.siglaBancada!, orientacao: l.orientacao! });
    orient.set(l.idVotacao!, a);
  }
  const objetos = new Map<string, { titulo: string; ementa: string }[]>();
  for await (const l of validarCsv(`camara ${ano} objetos`, lerCsvArquivo(`${c}/objetos.csv`), camara.COLUNAS.objetos, 20)) {
    if (!nominais.has(l.idVotacao!)) continue;
    const a = objetos.get(l.idVotacao!) ?? [];
    a.push({ titulo: l.proposicao_titulo ?? "", ementa: l.proposicao_ementa ?? "" });
    objetos.set(l.idVotacao!, a);
  }

  const votacoesAno = [...nominais].map((id) => plen.get(id)!).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const indiceVot = new Map(votacoesAno.map((v, i) => [v.id, i]));
  tabelasVotacoes[`camara-${ano}`] = votacoesAno.map((v) => ({ id: v.id, data: v.data, orgao: "PLEN", descricaoOficial: v.descricao, ...(((objetos.get(v.id) ?? []).length <= MAX_OBJETOS) ? { proposicoes: objetos.get(v.id) ?? [] } : { proposicoes: [], proposicoesVinculadas: (objetos.get(v.id) ?? []).length }), aprovada: v.aprovacao === "1", votosSim: v.sim, votosNao: v.nao, votosOutros: v.outros, ...classificarVotacao(v.descricao) }));

  for (const [id, votos] of votosPorDep) {
    const p = deputados.get(id)!;
    const d = detalhe(p);
    for (const leg of LEGISLATURAS) {
      const daLeg = votacoesAno.filter((v) => legislaturaDe(v.data) === leg);
      if (daLeg.length === 0) continue;
      const part = participacaoCamara(daLeg, new Map([...votos].map(([k, v]) => [k, v.voto])), p.exercicio);
      const b = bucket(p, ano, leg);
      b.votacoes.votou += part.votou;
      b.votacoes.total += part.total;
      for (const [k, n] of Object.entries(part.descontadas)) if (k !== "fora do exercício") b.votacoes.descontadas[k] = (b.votacoes.descontadas[k] ?? 0) + n;

      const itens: VotoComOrientacao[] = [];
      for (const v of daLeg) {
        const reg = votos.get(v.id);
        if (!reg || reg.voto === "Artigo 17") continue;
        itens.push({ voto: reg.voto, orientacao: orientacaoDoPartido(reg.partido, orient.get(v.id) ?? []) });
      }
      const al = calcularAlinhamento(itens);
      const bal = b.alinhamento!;
      bal.alinhados += al.alinhados;
      bal.total += al.total;
      bal.liberado += al.foraDoDenominador.liberado;
      bal.semOrientacao += al.foraDoDenominador.semOrientacao;
    }
    for (const [vid, reg] of votos) d.votos.push([indiceVot.get(vid)!, reg.voto, reg.voto === "Artigo 17" ? null : (orientacaoDoPartido(reg.partido, orient.get(vid) ?? []) ?? null)]);
  }
  // Participação para quem esteve em exercício mas não votou em nenhuma nominal do ano: total precisa existir.
  for (const p of deputados.values()) {
    if (votosPorDep.has(Number(p.idOrigem))) continue;
    for (const leg of LEGISLATURAS) {
      const daLeg = votacoesAno.filter((v) => legislaturaDe(v.data) === leg);
      if (daLeg.length === 0 || !daLeg.some((v) => emExercicio(v.data, p.exercicio))) continue;
      const part = participacaoCamara(daLeg, new Map(), p.exercicio);
      const b = bucket(p, ano, leg);
      b.votacoes.total += part.total;
    }
  }

  // ---- Câmara: CEAP
  for await (const l of validarCsv(`camara ${ano} ceap`, lerCsvDeZip(`${c}/ceap.csv.zip`), camara.COLUNAS.ceap, 1000)) {
    if (l.sgUF === "NA" || !l.ideCadastro) continue; // liderança partidária
    const p = deputados.get(Number(l.ideCadastro));
    const mes = Number(l.numMes);
    const aa = Number(l.numAno);
    if (!p) {
      relatorio.ceapCamaraSemParlamentar.set(l.ideCadastro, (relatorio.ceapCamaraSemParlamentar.get(l.ideCadastro) ?? 0) + 1);
      continue;
    }
    const leg = legislaturaDoMes(aa, mes);
    if (!leg || aa !== ano) continue;
    const categoria = categorizar("camara", l.txtDescricao ?? "");
    const valor = num(l.vlrLiquido);
    somarGasto(bucket(p, ano, leg), mes, categoria, valor);
    adicionarDespesa(detalhe(p), { mes, categoria, fornecedor: l.txtFornecedor ?? "", docBruto: l.txtCNPJCPF ?? "", valor });
  }

  // ---- Câmara: projetos (autores principais = proponente 1)
  const autoriasPorProp = new Map<string, { dep: number; principal: boolean }[]>();
  for await (const l of validarCsv(`camara ${ano} autores`, lerCsvArquivo(`${c}/autores.csv`), camara.COLUNAS.autores, 100)) {
    const dep = Number(l.idDeputadoAutor);
    if (!l.idDeputadoAutor || !deputados.has(dep)) continue;
    const a = autoriasPorProp.get(l.idProposicao!) ?? [];
    a.push({ dep, principal: l.proponente === "1" });
    autoriasPorProp.set(l.idProposicao!, a);
  }
  for await (const l of validarCsv(`camara ${ano} proposicoes`, lerCsvArquivo(`${c}/proposicoes.csv`), camara.COLUNAS.proposicoes, 100)) {
    const autores = autoriasPorProp.get(l.id!);
    if (!autores) continue;
    const data = l.dataApresentacao!.slice(0, 10);
    const leg = legislaturaDe(data);
    for (const a of autores) {
      const p = deputados.get(a.dep)!;
      if (TIPOS_PROJETO.has(l.siglaTipo!)) detalhe(p).projetos.push({ id: l.id, sigla: l.siglaTipo, numero: Number(l.numero), ano: Number(l.ano), ementa: l.ementa ?? "", data, principal: a.principal, situacao: l["ultimoStatus_descricaoSituacao"] ?? null });
      if (!leg) continue;
      const alvo = bucket(p, Number(data.slice(0, 4)), leg).projetos[a.principal ? "principal" : "coautor"];
      alvo[l.siglaTipo!] = (alvo[l.siglaTipo!] ?? 0) + 1;
    }
  }

  // ---- Senado: votações
  const vs = senado.votacoes.parse(await lerJson(`${RAW}/senado/${ano}/votacao.json`));
  const abertas = vs.filter((v) => v.votacaoSecreta === "N" && v.dataSessao.startsWith(String(ano))).sort((a, b) => a.dataSessao.localeCompare(b.dataSessao) || a.codigoSessaoVotacao - b.codigoSessaoVotacao);
  const secretas = vs.filter((v) => v.votacaoSecreta === "S" && v.dataSessao.startsWith(String(ano))).length;
  tabelasVotacoes[`senado-${ano}`] = abertas.map((v) => ({ id: String(v.codigoSessaoVotacao), data: v.dataSessao, orgao: "PLEN", descricaoOficial: v.descricaoVotacao ?? "", identificacao: v.identificacao ?? null, ementa: v.ementa ?? null, resultado: v.resultadoVotacao ?? null, votosNominais: v.votos.length, ...classificarVotacao(v.descricaoVotacao ?? "") }));
  const siglasPorSen = new Map<string, Map<number, string[]>>(); // codigo -> leg -> siglas
  abertas.forEach((v, i) => {
    const leg = legislaturaDe(v.dataSessao);
    if (!leg) return;
    for (const voto of v.votos) {
      const cod = String(voto.codigoParlamentar);
      const p = senadores.get(cod);
      if (!p) {
        relatorio.votosSemParlamentar++;
        continue;
      }
      const m = siglasPorSen.get(cod) ?? new Map<number, string[]>();
      m.set(leg, [...(m.get(leg) ?? []), voto.siglaVotoParlamentar]);
      siglasPorSen.set(cod, m);
      detalhe(p).votos.push([i, voto.siglaVotoParlamentar, null]);
    }
  });
  for (const [cod, porLeg] of siglasPorSen) {
    const p = senadores.get(cod)!;
    for (const [leg, siglas] of porLeg) {
      const part = participacaoSenado(siglas);
      const b = bucket(p, ano, leg);
      b.votacoes.votou += part.votou;
      b.votacoes.total += part.total;
      for (const [k, n] of Object.entries(part.descontadas)) b.votacoes.descontadas[k] = (b.votacoes.descontadas[k] ?? 0) + n;
    }
  }

  // ---- Senado: CEAPS (casamento por nome normalizado)
  for await (const l of validarCsv(`senado ${ano} ceaps`, lerCsvArquivo(`${RAW}/senado/${ano}/ceaps.csv`, { encoding: "latin1", pularLinhas: 1 }), senado.COLUNAS_CEAPS, 100)) {
    const nome = chaveNome(l.SENADOR ?? "");
    const mes = Number(l.MES);
    const aa = Number(l.ANO);
    if (aa !== ano) continue;
    const leg = legislaturaDoMes(aa, mes);
    let slugs = indiceNomes.get(nome);
    if (!slugs && nome in excecoesCeaps) {
      const e = excecoesCeaps[nome];
      slugs = e ? [e] : [];
    }
    if (!slugs) {
      relatorio.ceapsSemMatch.set(nome, (relatorio.ceapsSemMatch.get(nome) ?? 0) + 1);
      continue;
    }
    if (slugs.length === 0 || !leg) continue; // exceção declarada como fora do escopo, ou fora do período
    const candidatos = slugs.map((s) => porSlug.get(s)!).filter((p) => emExercicio(`${aa}-${String(mes).padStart(2, "0")}-15`, p.exercicio));
    const p = candidatos.length === 1 ? candidatos[0]! : slugs.length === 1 ? porSlug.get(slugs[0]!)! : null;
    if (!p) {
      relatorio.ceapsAmbiguo.set(nome, (relatorio.ceapsAmbiguo.get(nome) ?? 0) + 1);
      continue;
    }
    const categoria = categorizar("senado", l.TIPO_DESPESA ?? "");
    const valor = num(l.VALOR_REEMBOLSADO);
    somarGasto(bucket(p, ano, leg), mes, categoria, valor);
    adicionarDespesa(detalhe(p), { mes, categoria, fornecedor: l.FORNECEDOR ?? "", docBruto: l.CNPJ_CPF ?? "", valor });
  }

  // ---- Senado: projetos (processos do senador; autor principal = primeiro nome da lista de autores)
  for (const p of senadores.values()) {
    const arq = `${RAW}/senado/senadores/${p.idOrigem}-processos.json`;
    if (!existsSync(arq)) continue;
    const alvoNome = normalizarNome(p.nome);
    for (const proc of senado.processos.parse(await lerJson(arq))) {
      if (!proc.dataApresentacao.startsWith(String(ano))) continue;
      const sigla = proc.identificacao.split(" ")[0]!;
      const principal = normalizarNome(proc.autoria.split(",")[0] ?? "").includes(alvoNome);
      if (TIPOS_PROJETO.has(sigla)) detalhe(p).projetos.push({ id: String(proc.codigoMateria), sigla, identificacao: proc.identificacao, ementa: proc.ementa ?? "", data: proc.dataApresentacao, principal });
      const leg = legislaturaDe(proc.dataApresentacao);
      if (!leg) continue;
      const alvo = bucket(p, ano, leg).projetos[principal ? "principal" : "coautor"];
      alvo[sigla] = (alvo[sigla] ?? 0) + 1;
    }
  }

  // ---- gravar detalhe do ano
  let n = 0;
  for (const [slug, d] of detalhes) {
    const p = porSlug.get(slug)!;
    if (d.votos.length + d.despesas.size + d.projetos.length === 0) continue;
    await mkdir(`${OUT}/detalhe/${slug}`, { recursive: true });
    await writeFile(`${OUT}/detalhe/${slug}/${ano}.json`, JSON.stringify({ slug, casa: p.casa, ano, votos: d.votos, ...compactarDespesas(d.despesas), projetos: d.projetos.sort((a, b) => String(b.data).localeCompare(String(a.data))) }));
    n++;
  }
  console.log(`${ano}: ${nominais.size} votações nominais da Câmara, ${abertas.length} abertas no Senado (${secretas} secretas), ${n} arquivos de detalhe`);
}

// ---------------------------------------------------------------- relatórios e validação
const naoCasados = [...relatorio.ceapsSemMatch.entries()].sort((a, b) => b[1] - a[1]);
await writeFile(`${OUT}/relatorios/nao-casados.json`, JSON.stringify({ ceapsSemMatch: Object.fromEntries(naoCasados), ceapsAmbiguo: Object.fromEntries(relatorio.ceapsAmbiguo), ceapCamaraIdsForaDaLista: Object.fromEntries([...relatorio.ceapCamaraSemParlamentar].sort((a, b) => b[1] - a[1]).slice(0, 50)), votosSemParlamentar: relatorio.votosSemParlamentar }, null, 1));
if (naoCasados.length > 0 || relatorio.ceapsAmbiguo.size > 0) {
  console.error(`\nFALHA: ${naoCasados.length} nomes da CEAPS sem parlamentar e ${relatorio.ceapsAmbiguo.size} ambíguos. Relatório em ${OUT}/relatorios/nao-casados.json.\nAdicione cada nome (normalizado) em data/manual/ceaps-nomes.json com o slug, ou null se estiver fora do escopo. Dados processados anteriores foram mantidos.`);
  console.error(naoCasados.slice(0, 40).map(([n, q]) => `  ${n} (${q} linhas)`).join("\n"));
  process.exit(1);
}

// ---------------------------------------------------------------- agregados
const indice: unknown[] = [];
const arquivosAgregados: string[] = [];
const escrever = async (rel: string, conteudo: unknown) => {
  const s = JSON.stringify(conteudo);
  await writeFile(`${OUT}/agregados/${rel}`, s);
  arquivosAgregados.push(`${rel}:${s}`);
};
type Periodo = { rotulo: string; chave: string; metricas: Metricas };
const periodosPorSlug = new Map<string, Periodo[]>();
for (const p of pessoas) {
  const bs = buckets.get(p.slug);
  if (!bs) continue;
  const porAno: Record<string, Metricas> = {};
  const porLeg: Record<string, Metricas> = {};
  for (const [chave, m] of bs) {
    const [a, l] = chave.split("|") as [string, string];
    porAno[a] = porAno[a] ? somar(porAno[a]!, m) : m;
    porLeg[l] = porLeg[l] ? somar(porLeg[l]!, m) : m;
  }
  periodosPorSlug.set(p.slug, [...Object.entries(porAno).map(([k, m]) => ({ rotulo: "ano", chave: k, metricas: m })), ...Object.entries(porLeg).map(([k, m]) => ({ rotulo: "legislatura", chave: k, metricas: m }))]);
  // somar() com um bucket vazio arredonda os valores monetários (evita resíduo de ponto flutuante na saída)
  const limpo = (r: Record<string, Metricas>) => Object.fromEntries(Object.entries(r).map(([k, m]) => [k, somar(metricasVazias(p.casa === "camara"), m)]));
  const { exercicio, ...ident } = p;
  await escrever(`parlamentares/${p.slug}.json`, { parlamentar: { ...ident, exercicio }, porAno: limpo(porAno), porLegislatura: limpo(porLeg) });
  indice.push({ slug: p.slug, nome: p.nome, casa: p.casa, uf: p.uf, partido: p.partidoAtual, emExercicio: p.emExercicio, legislaturas: p.legislaturas });
}
indice.sort((a, b) => normalizarNome((a as { nome: string }).nome).localeCompare(normalizarNome((b as { nome: string }).nome)));
await escrever("indice.json", indice);

for (const [k, tabela] of Object.entries(tabelasVotacoes)) await escrever(`votacoes-${k}.json`, tabela);

// Rankings: exercício mínimo de 3 meses no período. % da cota não é publicado (limites por UF e ano pendentes).
const MIN_MESES = 3;
const rankingsGerados: string[] = [];
for (const casa of ["camara", "senado"] as Casa[]) {
  const periodos: [string, string][] = [...ANOS.map((a) => ["ano", String(a)] as [string, string]), ...LEGISLATURAS.map((l) => ["legislatura", String(l)] as [string, string])];
  for (const [rotulo, chave] of periodos) {
    const linhas = pessoas
      .filter((p) => p.casa === casa)
      .flatMap((p) => {
        const per = periodosPorSlug.get(p.slug)?.find((x) => x.rotulo === rotulo && x.chave === chave);
        return per && per.metricas.mesesExercicio >= MIN_MESES ? [{ p, m: per.metricas }] : [];
      });
    if (linhas.length === 0) continue;
    const base = (x: { p: Parlamentar; m: Metricas }) => ({ slug: x.p.slug, nome: x.p.nome, partido: x.p.partidoAtual, uf: x.p.uf, mesesExercicio: x.m.mesesExercicio });
    const defs: Record<string, { valor: (m: Metricas) => number | null; extra: (m: Metricas) => object }> = {
      "gasto-absoluto": { valor: (m) => Math.round(m.gastos.total * 100) / 100, extra: (m) => ({ lancamentos: m.gastos.lancamentos }) },
      participacao: { valor: (m) => (m.votacoes.total ? Math.round((m.votacoes.votou / m.votacoes.total) * 10000) / 10000 : null), extra: (m) => ({ votou: m.votacoes.votou, total: m.votacoes.total }) },
      projetos: { valor: (m) => projetosLegislativos(m.projetos.principal) + projetosLegislativos(m.projetos.coautor), extra: (m) => ({ principal: projetosLegislativos(m.projetos.principal), coautor: projetosLegislativos(m.projetos.coautor) }) },
    };
    for (const [metrica, def] of Object.entries(defs)) {
      const rows = linhas.flatMap((x) => { const v = def.valor(x.m); return v === null ? [] : [{ ...base(x), valor: v, ...def.extra(x.m) }]; }).sort((a, b) => b.valor - a.valor);
      const nome = `rankings/${casa}-${rotulo}-${chave}-${metrica}.json`;
      await escrever(nome, { casa, periodo: { tipo: rotulo, valor: chave }, metrica, minimoMesesExercicio: MIN_MESES, linhas: rows });
      rankingsGerados.push(nome);
    }
  }
}

// ---------------------------------------------------------------- meta + hash e troca atômica
const manifesto = existsSync(`${RAW}/MANIFEST.json`) ? (JSON.parse(await readFile(`${RAW}/MANIFEST.json`, "utf8")) as Record<string, string>) : {};
const datas = Object.values(manifesto).sort();
const hash = createHash("sha256").update(arquivosAgregados.sort().join("\n")).digest("hex");
await writeFile(`${OUT}/agregados/meta.json`, JSON.stringify({ geradoEm: hoje, hashAgregados: hash, fontes: { camara: { atualizadoEm: datas.at(-1) ?? null }, senado: { atualizadoEm: datas.at(-1) ?? null } }, anos: ANOS, minimoMesesExercicio: MIN_MESES, tiposProjeto: [...TIPOS_PROJETO], parlamentares: pessoas.length, rankings: rankingsGerados.length }, null, 1));

await rm(`${PROCESSADO}.antigo`, { recursive: true, force: true });
if (existsSync(PROCESSADO)) {
  await rename(PROCESSADO, `${PROCESSADO}.antigo`);
}
await rename(OUT, PROCESSADO);
await rm(`${PROCESSADO}.antigo`, { recursive: true, force: true });
console.log(`\nconcluído em ${((Date.now() - t0) / 1000).toFixed(0)} s. hash agregados ${hash.slice(0, 12)}`);
