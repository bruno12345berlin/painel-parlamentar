import { readFile, readdir } from "node:fs/promises";
import { LEGISLATURAS, PERIODO_LEGISLATURA, RAW } from "../config.js";
import type { Parlamentar } from "../model.js";
import { periodosCamara, type Periodo } from "../metrics/exercicio.js";
import * as camara from "../schemas/camara.js";
import * as senado from "../schemas/senado.js";
import { atribuirSlugs } from "./slug.js";

const INICIO = PERIODO_LEGISLATURA[56]!.inicio;
const lerJson = async (p: string) => JSON.parse(await readFile(p, "utf8")) as unknown;

/** Recorta os períodos para o escopo do site (de 2019-02-01 em diante) e descarta os vazios. */
function recortar(periodos: Periodo[]): Periodo[] {
  return periodos
    .filter((p) => (p.fim ?? "9999-12-31") >= INICIO)
    .map((p) => ({ inicio: p.inicio < INICIO ? INICIO : p.inicio, ...(p.fim ? { fim: p.fim } : {}) }));
}

export const legislaturasDe = (periodos: Periodo[]): number[] =>
  LEGISLATURAS.filter((l) => {
    const lp = PERIODO_LEGISLATURA[l]!;
    return periodos.some((p) => p.inicio <= lp.fim && (p.fim ?? "9999-12-31") >= lp.inicio);
  });

export interface PessoaBruta extends Omit<Parlamentar, "slug"> {
  nomesCeaps: string[]; // nomes pelos quais aparece na CEAPS (Senado)
}

export async function carregarPessoas(): Promise<{ pessoas: Parlamentar[]; nomesCeaps: Map<string, string[]> }> {
  const brutas: PessoaBruta[] = [];

  // Câmara
  const ids = new Set<number>();
  // Todos os perfis coletados (listas da API + quem aparece em votos/despesas): a lista da API é incompleta.
  for (const f of await readdir(`${RAW}/camara/deputados`)) ids.add(Number(f.replace(".json", "")));
  for (const id of ids) {
    const perfil = camara.deputado.parse(await lerJson(`${RAW}/camara/deputados/${id}.json`)).dados;
    const hist = camara.historico.parse(await lerJson(`${RAW}/camara/historico/${id}.json`)).dados;
    const exercicio = recortar(periodosCamara(hist));
    if (exercicio.length === 0) continue; // nunca exerceu o mandato no escopo
    const condicoes = new Set(hist.filter((h) => h.situacao === "Exercício").map((h) => (h.condicaoEleitoral ?? "").toLowerCase()));
    const st = perfil.ultimoStatus;
    brutas.push({
      casa: "camara",
      idOrigem: String(id),
      nome: (st.nomeEleitoral ?? st.nome).trim(),
      nomeCivil: perfil.nomeCivil,
      partidoAtual: st.siglaPartido,
      uf: st.siglaUf,
      ...(st.urlFoto ? { fotoUrl: st.urlFoto } : {}),
      emExercicio: st.situacao === "Exercício",
      legislaturas: legislaturasDe(exercicio),
      exercicio,
      condicao: condicoes.size > 1 ? "misto" : condicoes.has("suplente") ? "suplente" : "titular",
      contato: {
        ...(st.email ? { email: st.email } : {}),
        ...(st.gabinete?.telefone ? { telefone: st.gabinete.telefone } : {}),
        ...(perfil.redeSocial?.length ? { redes: perfil.redeSocial } : {}),
      },
      fonteUrl: `https://www.camara.leg.br/deputados/${id}`,
      nomesCeaps: [],
    });
  }

  // Senado
  const codigos = new Set<string>();
  for (const l of LEGISLATURAS)
    senado.listaLegislatura.parse(await lerJson(`${RAW}/senado/lista-${l}.json`)).ListaParlamentarLegislatura.Parlamentares.Parlamentar.forEach((p) => codigos.add(p.IdentificacaoParlamentar.CodigoParlamentar));
  for (const cod of codigos) {
    const det = senado.detalhe.parse(await lerJson(`${RAW}/senado/senadores/${cod}-detalhe.json`)).DetalheParlamentar.Parlamentar.IdentificacaoParlamentar;
    const mandatos = senado.mandatos.parse(await lerJson(`${RAW}/senado/senadores/${cod}-mandatos.json`)).MandatoParlamentar.Parlamentar.Mandatos.Mandato;
    const exercicio = recortar(mandatos.flatMap((m) => (m.Exercicios?.Exercicio ?? []).map((e) => ({ inicio: e.DataInicio, ...(e.DataFim ? { fim: e.DataFim } : {}) }))));
    if (exercicio.length === 0) continue;
    const recentes = [...mandatos].sort((a, b) => (b.Exercicios?.Exercicio[0]?.DataInicio ?? "").localeCompare(a.Exercicios?.Exercicio[0]?.DataInicio ?? ""))[0]!;
    const partidoAberto = mandatos.flatMap((m) => m.Partidos?.Partido ?? []).find((p) => !p.DataDesfiliacao);
    const ativo = exercicio.some((p) => p.fim === undefined);
    const doEscopo = mandatos.filter((m) => (m.Exercicios?.Exercicio ?? []).some((e) => (e.DataFim ?? "9999") >= INICIO));
    const suplente = doEscopo.every((m) => /suplente/i.test(m.DescricaoParticipacao ?? ""));
    const titular = doEscopo.every((m) => /titular/i.test(m.DescricaoParticipacao ?? ""));
    brutas.push({
      casa: "senado",
      idOrigem: cod,
      nome: det.NomeParlamentar.trim(),
      ...(det.NomeCompletoParlamentar ? { nomeCivil: det.NomeCompletoParlamentar } : {}),
      partidoAtual: partidoAberto?.Sigla ?? det.SiglaPartidoParlamentar ?? null,
      uf: recentes.UfParlamentar,
      ...(det.UrlFotoParlamentar ? { fotoUrl: det.UrlFotoParlamentar.replace(/^http:/, "https:") } : {}),
      emExercicio: ativo,
      legislaturas: legislaturasDe(exercicio),
      exercicio,
      condicao: titular ? "titular" : suplente ? "suplente" : "misto",
      contato: { ...(det.EmailParlamentar ? { email: det.EmailParlamentar } : {}) },
      fonteUrl: det.UrlPaginaParlamentar ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${cod}`,
      nomesCeaps: [det.NomeParlamentar],
    });
  }

  const slugs = await atribuirSlugs(brutas.map((b) => ({ casa: b.casa, idOrigem: b.idOrigem, nome: b.nome, uf: b.uf })));
  const nomesCeaps = new Map<string, string[]>();
  const pessoas = brutas.map(({ nomesCeaps: n, ...resto }) => {
    const slug = slugs.get(`${resto.casa}:${resto.idOrigem}`)!;
    for (const nome of n) nomesCeaps.set(nome, [...(nomesCeaps.get(nome) ?? []), slug]);
    return { slug, ...resto, ...(resto.fotoUrl ? { fotoLocal: `/fotos/${slug}.webp` } : {}) } as Parlamentar;
  });
  return { pessoas, nomesCeaps };
}
