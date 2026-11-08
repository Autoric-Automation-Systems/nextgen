import { describe, expect, it } from "vitest";
import { checkNewPassword, PASSWORD_MIN_LENGTH } from "../password-rules";

const valid = "treino-de-terca";

describe("checkNewPassword", () => {
  it("aceita uma frase longa e diferente da confirmação", () => {
    expect(checkNewPassword(valid, valid)).toEqual({ ok: true });
  });

  it("recusa senha curta antes de reclamar da confirmação", () => {
    const verdict = checkNewPassword("curta", "outra");

    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ message: expect.stringContaining(String(PASSWORD_MIN_LENGTH)) });
  });

  it("recusa quando as duas senhas não batem", () => {
    const verdict = checkNewPassword(valid, `${valid}-x`);

    expect(verdict).toMatchObject({ message: "As duas senhas não são iguais." });
  });

  it("recusa as senhas óbvias, em qualquer caixa", () => {
    for (const senha of ["nextgen2025", "NEXTGEN2025", "corinthians"]) {
      expect(checkNewPassword(senha, senha).ok).toBe(false);
    }
  });

  it("recusa senha que contém a parte antes do @ do e-mail", () => {
    const verdict = checkNewPassword("mariasouza2026", "mariasouza2026", "mariasouza@escola.test");

    expect(verdict).toMatchObject({ message: "A senha não pode conter o seu e-mail." });
  });

  it("não reclama do e-mail quando ele não foi informado", () => {
    expect(checkNewPassword("mariasouza2026", "mariasouza2026").ok).toBe(true);
  });

  it("ignora e-mail com menos de quatro letras antes do @", () => {
    // "rui" é curto demais para servir de regra: apareceria em qualquer frase.
    expect(checkNewPassword("rui-treina-forte", "rui-treina-forte", "rui@escola.test").ok).toBe(true);
  });

  it("recusa senha vazia com mensagem própria", () => {
    expect(checkNewPassword("", "")).toMatchObject({ message: "Informe uma senha." });
  });
});
