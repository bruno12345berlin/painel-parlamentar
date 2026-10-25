import { readFile, writeFile, mkdir } from "node:fs/promises";
import { lerCsvArquivo, lerCsvDeZip } from "../lib/csv.js";
import { categorizar } from "../metrics/categorias.js";
import { mascararDocumento, normalizarNome } from "../metrics/documentos.js";
import { periodosCamara, emExercicio, type Periodo } from "../metrics/exercicio.js";
import { resumirGastos, type Despesa } from "../metrics/gastos.js";
import { participacaoCamara, participacaoSenado } from "../metrics/participacao.js";
import { alinhamento, type VotoComOrientacao } from "../metrics/alinhamento.js";
import { ANO, DEPUTADO, RAW, SAIDA, SENADOR } from "./alvos.js";

const c = `${RAW}/camara`;
const s = `${RAW}/senado`;
const lerJson = async <T>(p: string) => JSON.parse(await readFile(p, "utf8")) as T;
const num = (t: string) => Number(t.replace(",", ".")) || 0;

// Tipos que entram na contagem principal de "projetos" (o restante aparece separado). Escolha a confirmar com o Bruno.
const TIPOS_PROJETO = new Set(["PL", "PLP", "PEC", "PDL", "PRC", "PDS", "PRS"]);

function contarProjetos(itens: { sigla: string; principal: boolean }[]) {
  const por = (principal: boolean) => {
    const r: Record<string, number> = {};
    for (const i of itens.filter((x) => x.principal === principal)) r[i.sigla] = (r[i.sigla] ?? 0) + 1;
    return r;
  };
  const soProjetos = (r: Record<string, number>) => Object.entries(r).filter(([k]) => TIPOS_PROJETO.has(k));
  const soma = (r: Record<string, number>) => soProjetos(r).reduce((a, [, n]) => a + n, 0);
  const principal = por(true);
  const coautor = por(false);
  return { principal, coautor, projetosPrincipal: soma(principal), projetosCoautor: soma(coautor) };
}

// ---------------------------------------------------------------- Câmara
async function deputado() {
  const id = DEPUTADO.idOrigem;
  const perfil = (await lerJson<{ dados: Record<string, any> }>(`${c}/deputado-${id}.json`)).dados;
  const hist = (await lerJson<{ dados: { dataHora: string; situacao: string | null; siglaPartido: string }[] }>(`${c}/historico-${id}.json`)).dados;
  const exercicio = periodosCamara(hist).map((p) => p); // sem recorte de ano: o filtro por data vem abaixo
  const ex: Periodo[] = exercicio;

  // Despesas (lote). Liderança partidária: sgUF = NA / ideCadastro vazio. CPF do deputado nunca é lido.
  const despesas: Despesa[] = [];
  let linhasLideranca = 0;
  for await (const l of lerCsvDeZip(`${c}/ceap-${ANO}.csv.zip`)) {
    if (l.sgUF === "NA" || !l.ideCadastro) {
      linhasLideranca++;
      continue;
    }
    if (l.ideCadastro !== id || Number(l.numAno) !== ANO) continue;
    despesas.push({
      ano: ANO,
      mes: Number(l.numMes),
      categoria: categorizar("camara", l.txtDescricao ?? ""),
      fornecedor: l.txtFornecedor ?? "",
      documentoFornecedor: mascararDocumento(l.txtCNPJCPF ?? ""),
      valorLiquido: num(l.vlrLiquido ?? "0"),
    });
  }

  // Votações do Plenário e votos
  const plen = new Map<string, { id: string; data: string; descricao: string }>();
  for await (const l of lerCsvArquivo(`${c}/votacoes-${ANO}.csv`))
    if (l.siglaOrgao === "PLEN") plen.set(l.id!, { id: l.id!, data: l.data!.slice(0, 10), descricao: l.descricao ?? "" });

  const nominais = new Set<string>();
  const meusVotos = new Map<string, { voto: string; partido: string }>();
  for await (const l of lerCsvArquivo(`${c}/votacoesVotos-${ANO}.csv`)) {
    if (!plen.has(l.idVotacao!)) continue;
    nominais.add(l.idVotacao!);
    if (l.deputado_id === id) meusVotos.set(l.idVotacao!, { voto: l.voto!, partido: l.deputado_siglaPartido! });
  }
  const votacoes = [...nominais].map((i) => plen.get(i)!).sort((a, b) => a.data.localeCompare(b.data));
  const participacao = participacaoCamara(votacoes, new Map([...meusVotos].map(([k, v]) => [k, v.voto])), ex);

  // Orientações: só resolvemos bancada = partido no dia do voto. Federações/blocos ainda não (tabela manual, Fase 2 completa).
  const orient = new Map<string, Map<string, string>>(); // votacao -> bancada -> orientacao
  for await (const l of lerCsvArquivo(`${c}/votacoesOrientacoes-${ANO}.csv`)) {
    if (!nominais.has(l.idVotacao!)) continue;
    const m = orient.get(l.idVotacao!) ?? new Map();
    m.set(l.siglaBancada!, l.orientacao!);
    orient.set(l.idVotacao!, m);
  }
  const itens: VotoComOrientacao[] = [];
  let bancadaNaoResolvida = 0;
  for (const [vid, v] of meusVotos) {
    if (v.voto === "Artigo 17") continue;
    const o = orient.get(vid)?.get(v.partido);
    if (o === undefined) bancadaNaoResolvida++;
    itens.push({ voto: v.voto, orientacao: o });
  }
  const alin = alinhamento(itens);

  // Projetos
  const meus = new Map<string, boolean>(); // idProposicao -> principal
  for await (const l of lerCsvArquivo(`${c}/proposicoesAutores-${ANO}.csv`))
    if (l.idDeputadoAutor === id) meus.set(l.idProposicao!, l.proponente === "1");
  const projetos: { sigla: string; numero: string; ano: string; ementa: string; data: string; principal: boolean; url: string }[] = [];
  for await (const l of lerCsvArquivo(`${c}/proposicoes-${ANO}.csv`))
    if (meus.has(l.id!))
      projetos.push({ sigla: l.siglaTipo!, numero: l.numero!, ano: l.ano!, ementa: l.ementa ?? "", data: l.dataApresentacao!.slice(0, 10), principal: meus.get(l.id!)!, url: `https://www.camara.leg.br/propostas-legislativas/${l.id}` });
  projetos.sort((a, b) => b.data.localeCompare(a.data));

  const recentes = [...meusVotos]
    .map(([vid, v]) => ({ ...plen.get(vid)!, voto: v.voto, partidoNoVoto: v.partido, orientacaoBancada: orient.get(vid)?.get(v.partido) ?? null }))
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 50);

  return {
    parlamentar: {
      slug: DEPUTADO.slug, casa: "camara", idOrigem: id, nome: perfil.ultimoStatus.nomeEleitoral ?? perfil.ultimoStatus.nome,
      partidoNoAno: [...new Set([...meusVotos.values()].map((v) => v.partido))], uf: perfil.ultimoStatus.siglaUf,
      situacaoAtual: perfil.ultimoStatus.situacao, fonteUrl: `https://www.camara.leg.br/deputados/${id}`,
    },
    ano: ANO,
    exercicio: ex,
    gastos: { ...resumirGastos(despesas), linhas: despesas.length },
    participacao: { ...participacao, votacoesNominaisPlenarioNoAno: votacoes.length },
    alinhamento: { ...alin, bancadaNaoResolvida },
    projetos: { ...contarProjetos(projetos), lista: projetos.slice(0, 50), total: projetos.length },
    votacoesRecentes: recentes,
    diagnostico: { linhasLiderancaIgnoradasNoCeap: linhasLideranca, autoriasSemProposicaoNoLote: meus.size - projetos.length },
  };
}

// ---------------------------------------------------------------- Senado
async function senador() {
  const id = SENADOR.idOrigem;
  const det = (await lerJson<any>(`${s}/senador-${id}.json`)).DetalheParlamentar.Parlamentar;
  const ident = det.IdentificacaoParlamentar;
  const mand = (await lerJson<any>(`${s}/mandatos-${id}.json`)).MandatoParlamentar.Parlamentar.Mandatos.Mandato[0];
  const lic = (await lerJson<any>(`${s}/licencas-${id}.json`)).LicencaParlamentar.Parlamentar.Licencas.Licenca as any[];
  const votacoes = (await lerJson<any[]>(`${s}/votacao-${ANO}.json`));

  // Votações nominais abertas em que o senador consta na lista
  const siglas: string[] = [];
  const recentes: any[] = [];
  const datasAfastamento = new Set<string>();
  for (const v of votacoes) {
    if (v.votacaoSecreta !== "N" || !String(v.dataSessao).startsWith(String(ANO))) continue;
    const meu = (v.votos as any[]).find((x) => String(x.codigoParlamentar) === id);
    if (!meu) continue;
    siglas.push(meu.siglaVotoParlamentar);
    if (["LS", "LP", "MIS", "AP"].includes(meu.siglaVotoParlamentar)) datasAfastamento.add(v.dataSessao);
    recentes.push({ data: v.dataSessao, descricao: v.descricaoVotacao, identificacao: v.identificacao, voto: meu.siglaVotoParlamentar, partidoNoVoto: meu.siglaPartidoParlamentar, resultado: v.resultadoVotacao });
  }
  recentes.sort((a, b) => b.data.localeCompare(a.data));
  const participacao = participacaoSenado(siglas);

  // Conferência cruzada: dias de votação com sigla de afastamento devem cair em licença registrada
  const periodosLic = lic.map((l) => ({ inicio: l.DataInicio as string, fim: (l.DataFim ?? l.DataInicio) as string }));
  const afastSemLicenca = [...datasAfastamento].filter((d) => !emExercicio(d, periodosLic));

  // Despesas CEAPS: casar por nome normalizado
  const nomeAlvo = normalizarNome(ident.NomeParlamentar);
  const despesas: Despesa[] = [];
  const naoCasados = new Set<string>();
  for await (const l of lerCsvArquivo(`${s}/ceaps-${ANO}.csv`, { encoding: "latin1", pularLinhas: 1 })) {
    if (normalizarNome(l.SENADOR ?? "") !== nomeAlvo) {
      continue;
    }
    despesas.push({
      ano: ANO, mes: Number(l.MES), categoria: categorizar("senado", l.TIPO_DESPESA ?? ""),
      fornecedor: l.FORNECEDOR ?? "", documentoFornecedor: mascararDocumento(l.CNPJ_CPF ?? ""), valorLiquido: num(l.VALOR_REEMBOLSADO ?? "0"),
    });
  }

  // Projetos via /processo; principal = primeiro nome da lista de autores (conferido 104/104 contra o endpoint antigo)
  const processos = await lerJson<any[]>(`${s}/processos-${id}-${ANO}.json`);
  const projetos = processos.map((p) => ({
    sigla: String(p.identificacao).split(" ")[0] as string, identificacao: p.identificacao as string, ementa: (p.ementa ?? "") as string,
    data: p.dataApresentacao as string, principal: normalizarNome(String(p.autoria).split(",")[0] ?? "").includes(nomeAlvo),
    url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.codigoMateria}`,
  }));
  projetos.sort((a, b) => b.data.localeCompare(a.data));

  const partidos = (mand.Partidos?.Partido ?? []) as any[];
  return {
    parlamentar: {
      slug: SENADOR.slug, casa: "senado", idOrigem: id, nome: ident.NomeParlamentar,
      partidoNoAno: [...new Set(recentes.map((r) => r.partidoNoVoto))], uf: mand.UfParlamentar,
      partidoAtual: partidos.find((p) => !p.DataDesfiliacao)?.Sigla ?? null, fonteUrl: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,
    },
    ano: ANO,
    exercicio: [{ inicio: mand.Exercicios.Exercicio[0].DataInicio }],
    gastos: { ...resumirGastos(despesas), linhas: despesas.length },
    participacao: { ...participacao, votacoesAbertasNoAno: siglas.length, votacoesSecretasNoAno: votacoes.filter((v) => v.votacaoSecreta === "S" && String(v.dataSessao).startsWith(String(ANO))).length },
    alinhamento: null, // Senado não publica orientação de bancada
    projetos: { ...contarProjetos(projetos), lista: projetos.slice(0, 50), total: projetos.length },
    votacoesRecentes: recentes.slice(0, 50),
    diagnostico: { afastamentoSemLicencaRegistrada: afastSemLicenca, naoCasadosCeaps: [...naoCasados] },
  };
}

await mkdir(SAIDA, { recursive: true });
for (const [slug, f] of [[DEPUTADO.slug, deputado], [SENADOR.slug, senador]] as const) {
  const t0 = Date.now();
  const r = await f();
  await writeFile(`${SAIDA}/${slug}.json`, JSON.stringify({ ...r, geradoEm: new Date().toISOString().slice(0, 10) }, null, 1));
  console.log(slug, "ok em", ((Date.now() - t0) / 1000).toFixed(1), "s");
}
