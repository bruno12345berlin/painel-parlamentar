import { z } from "zod";

/** A API (XML convertido em JSON) devolve um objeto no lugar de uma lista quando há um só item. */
const lista = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === undefined || v === null ? v : Array.isArray(v) ? v : [v]), z.array(t));

export const COLUNAS_CEAPS = ["ANO", "MES", "SENADOR", "TIPO_DESPESA", "CNPJ_CPF", "FORNECEDOR", "VALOR_REEMBOLSADO", "DATA"] as const;

export const listaLegislatura = z.object({
  ListaParlamentarLegislatura: z.object({
    Parlamentares: z.object({
      Parlamentar: lista(
        z.object({
          IdentificacaoParlamentar: z.object({ CodigoParlamentar: z.string(), NomeParlamentar: z.string(), NomeCompletoParlamentar: z.string().optional() }),
        }),
      ),
    }),
  }),
});

export const detalhe = z.object({
  DetalheParlamentar: z.object({
    Parlamentar: z.object({
      IdentificacaoParlamentar: z.object({
        CodigoParlamentar: z.string(),
        NomeParlamentar: z.string(),
        NomeCompletoParlamentar: z.string().optional(),
        UrlFotoParlamentar: z.string().optional(),
        EmailParlamentar: z.string().optional(),
        UrlPaginaParlamentar: z.string().optional(),
        SiglaPartidoParlamentar: z.string().optional(),
        UfParlamentar: z.string().optional(),
      }),
      DadosBasicosParlamentar: z.object({ DataNascimento: z.string().optional() }).optional(),
    }),
  }),
});

const exercicio = z.object({ DataInicio: z.string(), DataFim: z.string().optional(), SiglaCausaAfastamento: z.string().optional() });
export const mandatos = z.object({
  MandatoParlamentar: z.object({
    Parlamentar: z.object({
      Mandatos: z.object({
        Mandato: lista(
          z.object({
            UfParlamentar: z.string(),
            DescricaoParticipacao: z.string().optional(),
            Exercicios: z.object({ Exercicio: lista(exercicio) }).optional(),
            Partidos: z.object({ Partido: lista(z.object({ Sigla: z.string(), DataFiliacao: z.string().optional(), DataDesfiliacao: z.string().optional() })) }).optional(),
          }),
        ),
      }),
    }),
  }),
});

export const votacoes = z.array(
  z.object({
    codigoSessaoVotacao: z.number(),
    dataSessao: z.string(),
    descricaoVotacao: z.string().nullable().optional(),
    ementa: z.string().nullable().optional(),
    identificacao: z.string().nullable().optional(),
    resultadoVotacao: z.string().nullable().optional(),
    votacaoSecreta: z.enum(["S", "N"]),
    // votos pode vir null (votação sem registro individual): tratar como lista vazia
    votos: z
      .array(
        z.object({
          codigoParlamentar: z.union([z.number(), z.string()]),
          siglaVotoParlamentar: z.string(),
          siglaPartidoParlamentar: z.string().nullable().optional(),
        }),
      )
      .nullable()
      .transform((v) => v ?? []),
  }),
);

export const processos = z.array(
  z.object({
    autoria: z.string(),
    codigoMateria: z.number(),
    dataApresentacao: z.string(),
    ementa: z.string().nullable().optional(),
    identificacao: z.string(),
  }),
);
