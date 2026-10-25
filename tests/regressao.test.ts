import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressão dos agregados gerados (data/processed/agregados, versionados). Os valores abaixo foram conferidos à mão
// em 25/10/2026 (gasto: soma independente com awk nos arquivos oficiais; votos: contagem direta). Mudou um número?
// Só com explicação no commit.
const lerAgregado = (slug: string) => JSON.parse(readFileSync(`data/processed/agregados/parlamentares/${slug}.json`, "utf8"));
const temDados = existsSync("data/processed/agregados/parlamentares");

describe.skipIf(!temDados)("regressão dos agregados de 2024", () => {
  it("Abilio Brunini (Câmara)", () => {
    const m = lerAgregado("abilio-brunini-mt").porAno["2024"];
    expect(m.gastos.total).toBe(429804.34);
    expect(m.gastos.lancamentos).toBe(491);
    expect(m.votacoes).toMatchObject({ votou: 148, total: 273 });
    expect(m.alinhamento).toMatchObject({ alinhados: 127, total: 141 });
    expect(m.mesesExercicio).toBe(12);
  });
  it("Alan Rick (Senado): perfil separado do de deputado, sem alinhamento", () => {
    const d = lerAgregado("alan-rick-ac-senado");
    expect(d.parlamentar.casa).toBe("senado");
    const m = d.porAno["2024"];
    expect(m.gastos.total).toBe(511358.56);
    expect(m.votacoes).toMatchObject({ votou: 48, total: 55 });
    expect(m.alinhamento).toBeNull();
    expect(lerAgregado("alan-rick-ac").parlamentar.casa).toBe("camara");
  });
  it("nenhum parlamentar tem mais votos que votações, nem gasto com zero meses de exercício", () => {
    const indice = JSON.parse(readFileSync("data/processed/agregados/indice.json", "utf8")) as { slug: string }[];
    for (const { slug } of indice) {
      const d = lerAgregado(slug);
      for (const m of [...Object.values(d.porAno), ...Object.values(d.porLegislatura)] as { votacoes: { votou: number; total: number }; gastos: { total: number }; mesesExercicio: number }[]) {
        expect(m.votacoes.votou, slug).toBeLessThanOrEqual(m.votacoes.total);
        if (m.gastos.total > 1) expect(m.mesesExercicio, slug).toBeGreaterThan(0);
      }
    }
  });
});
