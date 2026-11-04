import { describe, expect, it } from "vitest";
import { applyDiscount, formatBRL, prorateMonthly, sum, toCents } from "../money";

describe("toCents", () => {
  it("converte formato brasileiro", () => {
    expect(toCents("R$ 1.234,56")).toBe(123456);
    expect(toCents("1.234,56")).toBe(123456);
    expect(toCents("250")).toBe(25000);
    expect(toCents("250,00")).toBe(25000);
    expect(toCents("0,05")).toBe(5);
  });

  it("converte formato com ponto decimal", () => {
    expect(toCents("250.00")).toBe(25000);
    expect(toCents(250.5)).toBe(25050);
  });

  it("rejeita valor inválido", () => {
    expect(() => toCents("abc")).toThrow(/inválido/);
    expect(() => toCents("")).toThrow(/inválido/);
  });

  it("não perde centavo em arredondamento", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("formatBRL", () => {
  it("formata em real", () => {
    expect(formatBRL(123456).replace(/\u00a0/g, " ")).toBe("R$ 1.234,56");
    expect(formatBRL(0).replace(/\u00a0/g, " ")).toBe("R$ 0,00");
  });
});

describe("applyDiscount", () => {
  it("aplica desconto", () => {
    expect(applyDiscount(25000, 5000)).toBe(20000);
  });

  it("nunca fica negativo", () => {
    expect(applyDiscount(25000, 30000)).toBe(0);
  });

  it("rejeita desconto negativo", () => {
    expect(() => applyDiscount(25000, -100)).toThrow();
  });
});

describe("prorateMonthly", () => {
  it("cobra mês cheio quando começa no dia 1", () => {
    expect(prorateMonthly(30000, 1, 30)).toBe(30000);
  });

  it("cobra proporcional no meio do mês", () => {
    expect(prorateMonthly(30000, 16, 30)).toBe(15000);
  });

  it("rejeita dia fora do mês", () => {
    expect(() => prorateMonthly(30000, 31, 30)).toThrow();
  });
});

describe("sum", () => {
  it("soma centavos", () => {
    expect(sum([1000, 2000, 350])).toBe(3350);
    expect(sum([])).toBe(0);
  });
});
