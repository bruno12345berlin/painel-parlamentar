// Único lugar com o nome e os textos globais do site (nome provisório).
export const site = {
  name: "Painel Parlamentar",
  tagline: "Gastos, votações e projetos de deputados federais e senadores desde 2019.",
  url: "https://painel-parlamentar.pages.dev",
  repoUrl: "https://github.com/bruno12345berlin/painel-parlamentar", // definir quando o repositório existir
  lang: "pt-BR",
  desde: 2019,
  // Preenchido pelo pipeline (Fase 2); null enquanto não há dados.
  dadosAtualizadosEm: null as string | null,
} as const;
