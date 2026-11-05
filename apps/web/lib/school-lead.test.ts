import { describe, expect, it } from "vitest";
import { allowRequest, looksLikeBot, schoolLeadSchema } from "./school-lead";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = {
  schoolName: "Escola Gol de Ouro",
  contactName: "Maria Souza",
  email: "Diretor@Escola.com.BR",
  phone: "",
  city: "",
  studentCount: "",
  message: "",
};

describe("schoolLeadSchema", () => {
  it("aceita o mínimo e normaliza o e-mail", () => {
    const parsed = schoolLeadSchema.parse(VALID);

    expect(parsed.email).toBe("diretor@escola.com.br");
    expect(parsed.phone).toBeNull();
  });

  it("recusa e-mail inválido", () => {
    const result = schoolLeadSchema.safeParse({ ...VALID, email: "nao-e-email" });

    expect(result.success).toBe(false);
  });

  it("recusa nome de escola com um caractere só", () => {
    expect(schoolLeadSchema.safeParse({ ...VALID, schoolName: "A" }).success).toBe(false);
  });

  it("converte contagem de alunos digitada como texto", () => {
    expect(schoolLeadSchema.parse({ ...VALID, studentCount: "80" }).studentCount).toBe(80);
  });

  it("recusa contagem negativa", () => {
    expect(schoolLeadSchema.safeParse({ ...VALID, studentCount: "-5" }).success).toBe(false);
  });

  it("descarta campo opcional vazio em vez de gravar string vazia", () => {
    expect(schoolLeadSchema.parse({ ...VALID, city: "   " }).city).toBeNull();
  });
});

describe("looksLikeBot", () => {
  it("identifica o campo armadilha preenchido", () => {
    expect(looksLikeBot(form({ ...VALID, website: "http://spam.example" }))).toBe(true);
  });

  it("deixa passar formulário de pessoa", () => {
    expect(looksLikeBot(form(VALID))).toBe(false);
  });
});

describe("allowRequest", () => {
  it("bloqueia depois do limite na mesma janela", () => {
    const now = 1_000_000;
    const key = "203.0.113.10";

    expect(allowRequest(key, now)).toBe(true);
    expect(allowRequest(key, now + 1)).toBe(true);
    expect(allowRequest(key, now + 2)).toBe(true);
    expect(allowRequest(key, now + 3)).toBe(false);
  });

  it("libera de novo quando a janela passou", () => {
    const key = "198.51.100.7";
    const now = 2_000_000;

    for (let index = 0; index < 3; index += 1) allowRequest(key, now + index);

    expect(allowRequest(key, now + 10 * 60 * 1000 + 1)).toBe(true);
  });

  it("conta por origem, não globalmente", () => {
    const now = 3_000_000;

    for (let index = 0; index < 3; index += 1) allowRequest("192.0.2.1", now + index);

    expect(allowRequest("192.0.2.2", now)).toBe(true);
  });
});
