// Tipos mínimos da fatia vertical (descartável). O modelo definitivo vem com os schemas zod.
export interface Fatia {
  parlamentar: { slug: string; casa: "camara" | "senado"; nome: string; uf: string; partidoNoAno: string[]; fonteUrl: string };
  ano: number;
  exercicio: { inicio: string; fim?: string }[];
  gastos: {
    total: number;
    linhas: number;
    porCategoria: Record<string, number>;
    porMes: number[];
    maioresFornecedores: { fornecedor: string; documento: string; total: number }[];
  };
  participacao: { votou: number; total: number; fracao: number | null; descontadas: Record<string, number> };
  alinhamento: { alinhados: number; total: number; fracao: number | null } | null;
  projetos: {
    total: number;
    projetosPrincipal: number;
    projetosCoautor: number;
    principal: Record<string, number>;
    coautor: Record<string, number>;
    lista: { sigla: string; ementa: string; data: string; principal: boolean; url: string; numero?: string; ano?: string; identificacao?: string }[];
  };
  votacoesRecentes: { data: string; descricao: string; voto: string; partidoNoVoto: string; orientacaoBancada?: string | null }[];
  geradoEm: string;
}

const arquivos = import.meta.glob<Fatia>("../../data/processed/slice/*.json", { eager: true, import: "default" });
export const fatias: Fatia[] = Object.values(arquivos);
