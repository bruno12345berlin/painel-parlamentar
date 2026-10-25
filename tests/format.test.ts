import { describe, expect, it } from "vitest";
import { dadosDesatualizados, formatarData, formatarPercentual, formatarReais } from "../src/lib/format";

describe("format", () => {
  it("formata data civil sem mudar o dia", () => {
    expect(formatarData("2026-10-25")).toBe("25/10/2026");
    expect(formatarData("2024-02-06T23:59:00")).toBe("06/02/2024");
  });
  it("formata reais e percentual em pt-BR", () => {
    expect(formatarReais(1148.7).replace(/\s/g, " ")).toBe("R$ 1.148,70");
    expect(formatarPercentual(0.123)).toBe("12,3%");
  });
  it("avisa de dados desatualizados após 7 dias", () => {
    const hoje = new Date("2026-10-25T12:00:00Z");
    expect(dadosDesatualizados("2026-10-20", hoje)).toBe(false);
    expect(dadosDesatualizados("2026-10-10", hoje)).toBe(true);
    expect(dadosDesatualizados(null, hoje)).toBe(false);
  });
});
