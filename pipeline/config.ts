export const ANO_INICIAL = 2019;
export const ANO_ATUAL = new Date().getFullYear();
export const ANOS = Array.from({ length: ANO_ATUAL - ANO_INICIAL + 1 }, (_, i) => ANO_INICIAL + i);
export const LEGISLATURAS = [56, 57] as const;
export const RAW = "data/raw";
export const PROCESSADO = "data/processed";
export const CAMARA_API = "https://dadosabertos.camara.leg.br";
export const SENADO_API = "https://legis.senado.leg.br/dadosabertos";

/** Início e fim (inclusive) de cada legislatura, em data civil. */
export const PERIODO_LEGISLATURA: Record<number, { inicio: string; fim: string }> = {
  56: { inicio: "2019-02-01", fim: "2023-01-31" },
  57: { inicio: "2023-02-01", fim: "2027-01-31" },
};
