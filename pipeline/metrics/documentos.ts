/** CPF de fornecedor pessoa física sempre mascarado (PLANO, seção 5). CNPJ (14 dígitos) pode aparecer completo. */
export function mascararDocumento(bruto: string): string {
  const d = bruto.replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  return d.length === 0 ? "" : "***"; // formato desconhecido: não arriscar expor
}

export function normalizarNome(n: string): string {
  return n
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type TipoFornecedor = "pf" | "pj" | "desconhecido";

/** Pessoa física (11 dígitos, CPF) ou jurídica (14 dígitos, CNPJ), pelo documento informado na fonte. */
export function tipoFornecedor(bruto: string): TipoFornecedor {
  const n = bruto.replace(/\D/g, "").length;
  return n === 11 ? "pf" : n === 14 ? "pj" : "desconhecido";
}

/** Chave para casar nomes da CEAPS com o nome parlamentar: sem acento, pontuação (hífen, ponto) vira espaço, sem "Dr."/"Dra."/"Prof.". */
export const chaveNome = (n: string): string =>
  normalizarNome(n)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(dr|dra|prof|profa) /, "");
