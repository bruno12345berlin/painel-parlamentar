// Tradução das siglas de voto do Senado (docs/FONTES.md). A sigla original é sempre guardada para auditoria.
const ROTULOS: Record<string, string> = {
  Sim: "Sim",
  Não: "Não",
  Abstenção: "Abstenção",
  "P-NRV": "Presente, não registrou voto",
  NCom: "Não compareceu",
  LS: "Licença saúde",
  LP: "Licença particular",
  MIS: "Missão da Casa",
  AP: "Atividade parlamentar (ausente)",
  NA: "Dispositivo não citado",
  "Presidente (art. 51 RISF)": "Presidiu a sessão",
  Votou: "Votou (voto secreto)",
};

export const rotuloVotoSenado = (sigla: string): string => ROTULOS[sigla] ?? sigla;
