export type TipoObjeto = "requerimento" | "destaque" | "emenda" | "proposicao" | "outro";

/**
 * Classifica a votação pelo texto oficial da descrição. `procedimental` = requerimento, destaque ou emenda
 * (regra publicada na metodologia). "Proposta de Emenda à Constituição" e "Emenda Constitucional" não são emendas.
 */
export function classificarVotacao(descricao: string): { tipoObjeto: TipoObjeto; procedimental: boolean } {
  const t = descricao
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/proposta de emenda( a constituicao)?/g, "pec")
    .replace(/emenda constitucional/g, "ec");
  let tipoObjeto: TipoObjeto;
  if (/\brequerimento\b/.test(t)) tipoObjeto = "requerimento";
  else if (/\bdestaque\b|\bdestacad[oa]s?\b|\bdvs\b/.test(t)) tipoObjeto = "destaque";
  else if (/\bemendas?\b|\bsubemenda\b/.test(t)) tipoObjeto = "emenda";
  else if (/projeto|\bpec\b|\bpl\b|\bplp\b|\bpdl\b|\bpdc\b|medida provisoria|\bmpv\b|\bveto\b|\bmensagem\b/.test(t)) tipoObjeto = "proposicao";
  else tipoObjeto = "outro";
  return { tipoObjeto, procedimental: tipoObjeto === "requerimento" || tipoObjeto === "destaque" || tipoObjeto === "emenda" };
}
