import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./error-message";

describe("loginErrorMessage", () => {
  it("explica o caso que devolve o usuário ao login sem conta criada", () => {
    const message = loginErrorMessage("new_user_signup_disabled");

    expect(message).toContain("Primeiro acesso");
  });

  it("reconhece o código em maiúsculas que o Better Auth usa no token", () => {
    expect(loginErrorMessage("INVALID_TOKEN")).toContain("expirou");
  });

  it("não inventa mensagem quando não há erro", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
  });

  it("tem texto de reserva para código desconhecido", () => {
    expect(loginErrorMessage("qualquer_coisa")).toContain("Tente de novo");
  });

  it("traduz a recusa de senha sem revelar se o e-mail existe", () => {
    const message = loginErrorMessage("INVALID_EMAIL_OR_PASSWORD");

    expect(message).toBe("E-mail ou senha incorretos.");
  });

  it("diz o mínimo de caracteres quando a senha é curta", () => {
    expect(loginErrorMessage("PASSWORD_TOO_SHORT")).toContain("10 caracteres");
  });
});
