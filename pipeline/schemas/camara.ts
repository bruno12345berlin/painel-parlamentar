import { z } from "zod";

// Colunas que o pipeline realmente lê. Se faltar alguma, a fonte mudou: parar com erro claro.
export const COLUNAS = {
  ceap: ["ideCadastro", "sgUF", "numAno", "numMes", "txtDescricao", "txtFornecedor", "txtCNPJCPF", "vlrLiquido", "vlrGlosa", "vlrDocumento", "datEmissao"],
  votacoes: ["id", "data", "siglaOrgao", "descricao"],
  votos: ["idVotacao", "voto", "deputado_id", "deputado_siglaPartido", "deputado_siglaUf"],
  orientacoes: ["idVotacao", "siglaBancada", "orientacao"],
  objetos: ["idVotacao", "proposicao_ementa", "proposicao_titulo"],
  proposicoes: ["id", "siglaTipo", "numero", "ano", "ementa", "dataApresentacao"],
  autores: ["idProposicao", "idDeputadoAutor", "proponente", "nomeAutor"],
} as const;

export const listaDeputados = z.object({
  dados: z.array(z.object({ id: z.number(), nome: z.string(), siglaPartido: z.string().nullable(), siglaUf: z.string(), idLegislatura: z.number() })),
});

export const deputado = z.object({
  dados: z.object({
    id: z.number(),
    nomeCivil: z.string(),
    dataNascimento: z.string().nullable().optional(),
    redeSocial: z.array(z.string()).optional(),
    urlWebsite: z.string().nullable().optional(),
    ultimoStatus: z.object({
      nome: z.string(),
      nomeEleitoral: z.string().nullable().optional(),
      siglaPartido: z.string().nullable(),
      siglaUf: z.string(),
      urlFoto: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      situacao: z.string().nullable().optional(),
      gabinete: z.object({ telefone: z.string().nullable().optional(), email: z.string().nullable().optional() }).partial().nullable().optional(),
    }),
  }),
});

export const historico = z.object({
  dados: z.array(z.object({ dataHora: z.string(), situacao: z.string().nullable(), condicaoEleitoral: z.string().nullable().optional(), siglaPartido: z.string().nullable(), siglaUf: z.string().nullable().optional() })),
});
