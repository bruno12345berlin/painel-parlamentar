export type Categoria =
  | "passagens"
  | "locomocao-hospedagem-alimentacao"
  | "escritorio"
  | "divulgacao"
  | "consultorias"
  | "seguranca"
  | "outros";

export const ROTULOS: Record<Categoria, string> = {
  passagens: "Passagens",
  "locomocao-hospedagem-alimentacao": "Locomoção, hospedagem e alimentação",
  escritorio: "Escritório e comunicação",
  divulgacao: "Divulgação da atividade parlamentar",
  consultorias: "Consultorias e pesquisas",
  seguranca: "Segurança",
  outros: "Outros",
};

// O Senado agrupa locomoção, hospedagem, alimentação e combustíveis em um só tipo; por isso a categoria comum
// também agrupa (a Câmara é somada nela). Prefixos comparados sem acento e em minúsculas.
const CAMARA: [string, Categoria][] = [
  ["passagem aerea", "passagens"],
  ["passagens terrestres", "passagens"],
  ["combustiveis", "locomocao-hospedagem-alimentacao"],
  ["servico de taxi", "locomocao-hospedagem-alimentacao"],
  ["fornecimento de alimentacao", "locomocao-hospedagem-alimentacao"],
  ["hospedagem", "locomocao-hospedagem-alimentacao"],
  ["locacao ou fretamento", "locomocao-hospedagem-alimentacao"],
  ["manutencao de escritorio", "escritorio"],
  ["telefonia", "escritorio"],
  ["assinatura de publicacoes", "escritorio"],
  ["aquisicao de tokens", "escritorio"],
  ["divulgacao", "divulgacao"],
  ["servico de seguranca", "seguranca"],
  ["consultorias", "consultorias"],
];
const SENADO: [string, Categoria][] = [
  ["passagens aereas", "passagens"],
  ["locomocao, hospedagem", "locomocao-hospedagem-alimentacao"],
  ["aluguel de imoveis", "escritorio"],
  ["aquisicao de material de consumo", "escritorio"],
  ["divulgacao da atividade", "divulgacao"],
  ["contratacao de consultorias", "consultorias"],
  ["servicos de seguranca", "seguranca"],
];

const sem = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export function categorizar(casa: "camara" | "senado", original: string): Categoria {
  const t = sem(original);
  const tabela = casa === "camara" ? CAMARA : SENADO;
  return tabela.find(([prefixo]) => t.startsWith(prefixo))?.[1] ?? "outros";
}
