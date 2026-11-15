import { describe, expect, it } from "vitest";
import {
  UF_CODES,
  formatZip,
  normalizeState,
  normalizeZip,
  roomIssue,
  unitIssue,
  validState,
} from "./unit-rules";

const base = {
  name: "Unidade Centro",
  address: "Rua Cardeal Arcoverde, 1200",
  city: "São Paulo",
  state: "SP",
  zip: "01310100",
};

describe("CEP", () => {
  it("reduz qualquer enfeite de digitação a 8 dígitos", () => {
    expect(normalizeZip("01310-100")).toBe("01310100");
    expect(normalizeZip("01310.100")).toBe("01310100");
    expect(normalizeZip(" 01310100 ")).toBe("01310100");
  });

  it("formata só quando o CEP está completo", () => {
    expect(formatZip("01310100")).toBe("01310-100");
    expect(formatZip("0131")).toBe("0131");
    expect(formatZip("")).toBe("");
  });
});

describe("UF", () => {
  it("aceita as 27 unidades federativas e nada além", () => {
    expect(UF_CODES).toHaveLength(27);
    expect(validState("sp")).toBe(true);
    expect(validState(" SP ")).toBe(true);
    expect(validState("XX")).toBe(false);
    expect(validState("SPX")).toBe(false);
    expect(normalizeState("rj")).toBe("RJ");
  });
});

describe("unitIssue", () => {
  it("aceita um cadastro completo", () => {
    expect(unitIssue(base)).toBeNull();
  });

  it("aceita CEP com hífen, porque quem digita hífen está certo", () => {
    expect(unitIssue({ ...base, zip: "01310-100" })).toBeNull();
  });

  it("recusa endereço vazio ou só com o nome da rua", () => {
    // Não exijo dígito: "Estrada do Campo, s/n" é endereço legítimo de escola de futebol.
    expect(unitIssue({ ...base, address: "Rua" })).toContain("endereço");
    expect(unitIssue({ ...base, address: "   " })).toContain("endereço");
  });

  it("recusa UF inexistente", () => {
    expect(unitIssue({ ...base, state: "EX" })).toContain("UF");
  });

  it("recusa CEP curto e CEP com letra", () => {
    expect(unitIssue({ ...base, zip: "0131010" })).toContain("8 dígitos");
    expect(unitIssue({ ...base, zip: "abcdefgh" })).toContain("8 dígitos");
  });

  it("recusa nome vazio ou gigante", () => {
    expect(unitIssue({ ...base, name: " " })).toContain("nome");
    expect(unitIssue({ ...base, name: "U".repeat(61) })).toContain("60");
  });
});

describe("roomIssue", () => {
  it("aceita sala com capacidade plausível", () => {
    expect(roomIssue({ name: "Campo 1", capacity: 24 })).toBeNull();
    expect(roomIssue({ name: "Quadra", capacity: 1 })).toBeNull();
  });

  it("recusa capacidade zero, fracionada ou absurda", () => {
    expect(roomIssue({ name: "Campo 1", capacity: 0 })).toContain("1 a 200");
    expect(roomIssue({ name: "Campo 1", capacity: 2.5 })).toContain("1 a 200");
    expect(roomIssue({ name: "Campo 1", capacity: 500 })).toContain("1 a 200");
  });

  it("recusa sala sem nome", () => {
    expect(roomIssue({ name: "", capacity: 10 })).toContain("nome");
  });
});
