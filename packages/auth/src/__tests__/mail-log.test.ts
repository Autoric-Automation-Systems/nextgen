import { describe, expect, it } from "vitest";
import { maskAddress } from "../mail-log";

describe("maskAddress", () => {
  it("esconde a parte local e mantém o domínio", () => {
    expect(maskAddress("ana.silva@escola.com.br")).toBe("a***@escola.com.br");
  });

  it("não deixa a parte local vazar em endereço de um caractere", () => {
    expect(maskAddress("a@x.com")).toBe("a***@x.com");
  });

  it("trata entrada sem domínio sem quebrar", () => {
    expect(maskAddress("sem-arroba")).toBe("***");
  });
});
