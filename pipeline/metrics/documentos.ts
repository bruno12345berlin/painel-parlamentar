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
