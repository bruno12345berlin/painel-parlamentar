import { describe, expect, it } from "vitest";
import { alinhamento } from "../pipeline/metrics/alinhamento";
import { categorizar } from "../pipeline/metrics/categorias";
import { mascararDocumento, normalizarNome, tipoFornecedor } from "../pipeline/metrics/documentos";
import { emExercicio, periodosCamara } from "../pipeline/metrics/exercicio";
import { resumirGastos, type Despesa } from "../pipeline/metrics/gastos";
import { rotuloVotoSenado } from "../pipeline/metrics/siglasSenado";
import { participacaoCamara, participacaoSenado } from "../pipeline/metrics/participacao";

const desp = (mes: number, valorLiquido: number, extra: Partial<Despesa> = {}): Despesa => ({
  ano: 2024, mes, categoria: "passagens", fornecedor: "F", documentoFornecedor: "00.000.000/0001-00", tipoFornecedor: "pj", valorLiquido, ...extra,
});

describe("gastos", () => {
  it("soma valor líquido, incluindo devolução negativa, sem ruído de ponto flutuante", () => {
    const r = resumirGastos([desp(1, 0.1), desp(1, 0.2), desp(2, 100), desp(2, -40)]);
    expect(r.total).toBe(60.3);
    expect(r.porMes[0]).toBe(0.3);
    expect(r.porMes[1]).toBe(60);
  });
  it("agrupa maiores fornecedores por documento", () => {
    const r = resumirGastos([desp(1, 10, { fornecedor: "A", documentoFornecedor: "1", tipoFornecedor: "pj" }), desp(2, 30, { fornecedor: "A", documentoFornecedor: "1", tipoFornecedor: "pj" }), desp(1, 25, { fornecedor: "B", documentoFornecedor: "2", tipoFornecedor: "pj" })], 1);
    expect(r.maioresFornecedores).toEqual([{ fornecedor: "A", documento: "1", tipo: "pj", total: 40 }]);
  });
});

describe("documentos e nomes", () => {
  it("mascara CPF (inclusive no formato irregular da Câmara) e mantém CNPJ", () => {
    expect(mascararDocumento("346.769.613/91  -")).toBe("***.769.613-**");
    expect(mascararDocumento("123.456.789-09")).toBe("***.456.789-**");
    expect(mascararDocumento("085.324.290/0013-1")).toBe("08.532.429/0001-31"); // CNPJ com formatação irregular da Câmara
    expect(mascararDocumento("12.345.678/0001")).toBe("***"); // contagem de dígitos desconhecida: não expor
    expect(mascararDocumento("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(mascararDocumento("")).toBe("");
  });
  it("classifica fornecedor como pessoa física, jurídica ou desconhecido", () => {
    expect(tipoFornecedor("346.769.613/91  -")).toBe("pf");
    expect(tipoFornecedor("11.222.333/0001-81")).toBe("pj");
    expect(tipoFornecedor("")).toBe("desconhecido");
  });
  it("normaliza nomes sem acento", () => {
    expect(normalizarNome("  Acácio  FAVACHO ")).toBe("acacio favacho");
  });
});

describe("categorias", () => {
  it("mapeia Câmara e Senado para o conjunto comum; desconhecido vai para outros", () => {
    expect(categorizar("camara", "PASSAGEM AÉREA - SIGEPA")).toBe("passagens");
    expect(categorizar("camara", "COMBUSTÍVEIS E LUBRIFICANTES.")).toBe("locomocao-hospedagem-alimentacao");
    expect(categorizar("senado", "Locomoção, hospedagem, alimentação, combustíveis e lubrificantes")).toBe("locomocao-hospedagem-alimentacao");
    expect(categorizar("senado", "")).toBe("outros");
  });
});

describe("exercício (Câmara)", () => {
  it("fecha o período na vacância e reabre na volta; ignora linhas sem situação", () => {
    const p = periodosCamara([
      { dataHora: "2023-02-01T00:00", situacao: null },
      { dataHora: "2023-02-01T12:05", situacao: "Exercício" },
      { dataHora: "2023-06-10T10:00", situacao: "Exercício" }, // troca de partido: não reabre
      { dataHora: "2023-09-01T10:00", situacao: "Licença" },
      { dataHora: "2023-10-01T10:00", situacao: "Exercício" },
      { dataHora: "2025-01-01T00:00", situacao: "VACANCIA" },
    ]);
    expect(p).toEqual([{ inicio: "2023-02-01", fim: "2023-08-31" }, { inicio: "2023-10-01", fim: "2024-12-31" }]);
    expect(emExercicio("2023-09-15", p)).toBe(false);
    expect(emExercicio("2024-12-31", p)).toBe(true);
    expect(emExercicio("2025-01-01", p)).toBe(false);
  });
});

describe("participação (Câmara)", () => {
  const votacoes = [1, 2, 3, 4, 5].map((i) => ({ id: `v${i}`, data: `2024-0${i}-10` }));
  it("conta obstrução e abstenção como voto; presidiu sai dos dois lados; fora do exercício sai", () => {
    const votos = new Map([["v1", "Sim"], ["v2", "Obstrução"], ["v3", "Artigo 17"], ["v5", "Não"]]);
    const r = participacaoCamara(votacoes, votos, [{ inicio: "2024-01-01", fim: "2024-04-30" }]);
    expect(r).toMatchObject({ votou: 2, total: 3, descontadas: { "fora do exercício": 1, presidiu: 1 } });
    expect(r.fracao).toBeCloseTo(2 / 3);
  });
  it("sem votações no período, a fração é nula (não zero)", () => {
    expect(participacaoCamara([], new Map(), []).fracao).toBeNull();
  });
});

describe("participação (Senado)", () => {
  it("desconta afastamentos e presidência; P-NRV, NCom e secreta-'Votou' não contam como voto", () => {
    const r = participacaoSenado(["Sim", "Não", "Abstenção", "P-NRV", "NCom", "LS", "MIS", "Presidente (art. 51 RISF)"]);
    expect(r.votou).toBe(3);
    expect(r.total).toBe(5);
    expect(r.descontadas).toMatchObject({ presidiu: 1, "licença saúde": 1, "missão da Casa": 1 });
  });
});

describe("participação (Senado): AP", () => {
  it("atividade parlamentar (AP) conta como ausência, não sai do denominador", () => {
    const r = participacaoSenado(["Sim", "AP", "AP", "LS"]);
    expect(r).toMatchObject({ votou: 1, total: 3 });
    expect(r.descontadas).not.toHaveProperty("atividade parlamentar");
  });
});

describe("alinhamento", () => {
  it("tira Liberado e sem orientação do denominador", () => {
    const r = alinhamento([
      { voto: "Sim", orientacao: "Sim" },
      { voto: "Não", orientacao: "Sim" },
      { voto: "Sim", orientacao: "Liberado" },
      { voto: "Sim", orientacao: "" },
      { voto: "Obstrução", orientacao: "Obstrução" },
      { voto: "Sim", orientacao: undefined },
    ]);
    expect(r).toMatchObject({ alinhados: 2, total: 3, foraDoDenominador: { liberado: 1, semOrientacao: 2 } });
  });
});

describe("siglas do Senado", () => {
  it("traduz siglas conhecidas e preserva as desconhecidas", () => {
    expect(rotuloVotoSenado("P-NRV")).toBe("Presente, não registrou voto");
    expect(rotuloVotoSenado("XYZ")).toBe("XYZ");
  });
});
