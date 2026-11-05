import { describe, expect, it } from "vitest";
import {
  cardRating,
  canShowCardRating,
  developmentIndex,
  pillarAverage,
  skillByCode,
} from "../skills";

const scores = [
  { code: "CTL", score: 4 },
  { code: "PAS", score: 3 },
  { code: "FIN", score: 5 },
  { code: "DRI", score: 4 },
  { code: "DIS", score: 2 },
];

describe("skillByCode", () => {
  it("encontra pelo código, sem depender de caixa", () => {
    expect(skillByCode("ctl")?.name).toBe("Controle");
  });

  it("devolve nulo para código desconhecido", () => {
    expect(skillByCode("XXX")).toBeNull();
  });
});

describe("pillarAverage", () => {
  it("calcula a média só dos atributos do pilar", () => {
    expect(pillarAverage(scores, "technical")).toBe(4);
  });

  it("devolve nulo quando o pilar não foi avaliado", () => {
    expect(pillarAverage(scores, "physical")).toBeNull();
  });
});

describe("developmentIndex", () => {
  it("converte a média 1–5 para 0–100", () => {
    expect(developmentIndex([{ code: "CTL", score: 3 }])).toBe(50);
  });

  it("devolve nulo sem notas", () => {
    expect(developmentIndex([])).toBeNull();
  });
});

describe("cardRating", () => {
  it("usa a fórmula do doc 08: 40 + (média - 1) × 15", () => {
    expect(cardRating([{ code: "CTL", score: 5 }])).toBe(100);
    expect(cardRating([{ code: "CTL", score: 3 }])).toBe(70);
    expect(cardRating([{ code: "CTL", score: 1 }])).toBe(40);
  });

  it("arredonda a média antes de escalar", () => {
    expect(cardRating([{ code: "CTL", score: 4 }, { code: "PAS", score: 3 }])).toBe(78);
  });

  it("devolve nulo sem notas", () => {
    expect(cardRating([])).toBeNull();
  });
});

describe("canShowCardRating", () => {
  it("esconde a nota de menor de 12", () => {
    expect(canShowCardRating(9)).toBe(false);
    expect(canShowCardRating(11)).toBe(false);
  });

  it("mostra a nota a partir de 12", () => {
    expect(canShowCardRating(12)).toBe(true);
  });
});
