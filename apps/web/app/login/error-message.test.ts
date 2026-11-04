import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "./error-message";

describe("loginErrorMessage", () => {
  it("explica o caso que devolve o usuário ao login sem conta criada", () => {
    const message = loginErrorMessage("new_user_signup_disabled");

    expect(message).toContain("cadastrar seu login");
  });

  it("reconhece o código em maiúsculas que o Better Auth usa no token", () => {
    expect(loginErrorMessage("INVALID_TOKEN")).toContain("expirou");
  });

  it("não inventa mensagem quando não há erro", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
  });

  it("tem texto de reserva para código desconhecido", () => {
    expect(loginErrorMessage("qualquer_coisa")).toContain("Peça um novo");
  });
});
