import { describe, expect, it } from "vitest";
import { classificarVotacao } from "../pipeline/normalize/votacao";
import { slugificar } from "../pipeline/normalize/slug";

describe("classificarVotacao", () => {
  it("requerimento, destaque e emenda são procedimentais", () => {
    expect(classificarVotacao("Aprovado o Requerimento de Urgência")).toEqual({ tipoObjeto: "requerimento", procedimental: true });
    expect(classificarVotacao("Votação nominal da Emenda nº 14 ao Projeto de Lei nº 210, de 2024, destacada.")).toMatchObject({ tipoObjeto: "destaque", procedimental: true });
    expect(classificarVotacao("Rejeitada a Emenda nº 3")).toMatchObject({ tipoObjeto: "emenda", procedimental: true });
  });
  it("PEC e projetos são de mérito; 'Proposta de Emenda à Constituição' não é emenda", () => {
    expect(classificarVotacao("Votação nominal da Proposta de Emenda à Constituição nº 54, de 2024 (2º Turno).")).toEqual({ tipoObjeto: "proposicao", procedimental: false });
    expect(classificarVotacao("Aprovado o Projeto de Lei nº 3.802, de 2024. Sim: 340; Não: 117")).toEqual({ tipoObjeto: "proposicao", procedimental: false });
  });
  it("sem pista no texto: outro, não procedimental", () => {
    expect(classificarVotacao("Realizar o encaminhamento da matéria")).toEqual({ tipoObjeto: "outro", procedimental: false });
  });
});

describe("slugificar", () => {
  it("remove acentos e pontuação", () => {
    expect(slugificar("Acácio  Favacho")).toBe("acacio-favacho");
    expect(slugificar("Dr. Zé d'Ávila")).toBe("dr-ze-d-avila");
  });
});
