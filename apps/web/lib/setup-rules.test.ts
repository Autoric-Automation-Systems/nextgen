import { describe, expect, it } from "vitest";
import { firstRunSchema, schoolSlug } from "./setup-rules";

describe("firstRunSchema", () => {
  it("normaliza e-mail e razão social vazia", () => {
    const parsed = firstRunSchema.parse({
      adminName: "  Maria Souza ",
      email: "  Diretor@Escola.COM.BR ",
      schoolName: "Escola Gol de Ouro",
      schoolLegalName: "   ",
    });

    expect(parsed.email).toBe("diretor@escola.com.br");
    expect(parsed.adminName).toBe("Maria Souza");
    expect(parsed.schoolLegalName).toBeNull();
  });

  it("recusa e-mail inválido antes de qualquer escrita", () => {
    const parsed = firstRunSchema.safeParse({
      adminName: "Maria",
      email: "maria",
      schoolName: "Escola",
      schoolLegalName: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("e-mail inválido");
  });
});

describe("schoolSlug", () => {
  it("remove acentos e pontuação para virar URL", () => {
    expect(schoolSlug("Escola Gol de Ouro")).toBe("escola-gol-de-ouro");
    expect(schoolSlug("  Ação & Cia. ")).toBe("acao-cia");
  });

  it("não deixa hífen nas pontas nem passa do limite da coluna", () => {
    const slug = schoolSlug("---" + "a".repeat(80) + "---");
    expect(slug).toBe("a".repeat(48));
  });
});
