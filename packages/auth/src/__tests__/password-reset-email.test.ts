import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail } from "../password-reset-email";

const base = {
  url: "https://nextgen.test/api/auth/reset-password/abc123?callbackURL=%2Fredefinir-senha",
  email: "responsavel@exemplo.test",
  appUrl: "https://nextgen.test/",
};

describe("buildPasswordResetEmail", () => {
  it("assunto próprio, diferente do link de acesso", () => {
    expect(buildPasswordResetEmail(base).subject).toBe("Definir sua senha do NextGen");
  });

  it("leva o link no botão e por extenso", () => {
    const { html } = buildPasswordResetEmail(base);

    expect(html.split("reset-password/abc123").length - 1).toBe(3);
    expect(html).toContain("Definir senha");
  });

  it("diz o prazo e que a senha atual continua valendo", () => {
    const { html, text } = buildPasswordResetEmail(base);

    expect(html).toContain("Válido por 30 minutos");
    expect(text).toContain("vale por 30 minutos");
    expect(text).toContain("Sua senha continua a mesma");
  });

  it("respeita prazo diferente quando informado", () => {
    const five = buildPasswordResetEmail({ ...base, expiresInMinutes: 5 });

    expect(five.html).toContain("Válido por 5 minutos");
  });
});
