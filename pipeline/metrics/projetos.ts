/** Tipos que entram na contagem principal de "projetos" (decisão de 25/10/2026); o resto (requerimentos etc.) fica à parte. */
export const TIPOS_PROJETO = new Set(["PL", "PLP", "PEC", "PDL", "PRC", "PDS", "PRS"]);

export const projetosLegislativos = (porTipo: Record<string, number>): number =>
  Object.entries(porTipo).reduce((a, [k, n]) => a + (TIPOS_PROJETO.has(k) ? n : 0), 0);
