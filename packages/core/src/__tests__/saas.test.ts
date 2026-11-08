import { describe, expect, it } from "vitest";
import {
  SAAS_PLANS,
  firstDueDate,
  daysLeftInTrial,
  effectiveStatus,
  nextPeriodEnd,
  planPriceCents,
  saasPlan,
  suggestedPlan,
} from "../saas";

describe("planPriceCents", () => {
  it("Campo é valor fixo, independente do número de alunos", () => {
    expect(planPriceCents("campo", 10)).toBe(19_900);
    expect(planPriceCents("campo", 80)).toBe(19_900);
  });

  it("Escola é por aluno com piso", () => {
    expect(planPriceCents("escola", 100)).toBe(35_000);
    expect(planPriceCents("escola", 50)).toBe(34_900);
  });

  it("Clube é por aluno com piso maior", () => {
    expect(planPriceCents("clube", 400)).toBe(112_000);
    expect(planPriceCents("clube", 50)).toBe(89_900);
  });

  it("recusa plano desconhecido em vez de cobrar zero", () => {
    expect(() => planPriceCents("ouro", 10)).toThrow(/plano desconhecido/);
  });
});

describe("suggestedPlan", () => {
  it("propõe o plano que cabe na quantidade de alunos", () => {
    expect(suggestedPlan(40).code).toBe("campo");
    expect(suggestedPlan(81).code).toBe("escola");
    expect(suggestedPlan(301).code).toBe("clube");
  });

  it("a tabela cobre do zero ao infinito, sem buraco entre faixas", () => {
    for (const students of [0, 1, 80, 81, 300, 301, 5_000]) {
      expect(suggestedPlan(students)).toBeTruthy();
    }
    expect(SAAS_PLANS.map((plan) => plan.code)).toEqual(["campo", "escola", "clube"]);
  });
});

describe("ciclo da assinatura", () => {
  it("próximo vencimento cai no mesmo dia do mês", () => {
    expect(nextPeriodEnd(new Date("2026-11-10T00:00:00.000Z")).toISOString().slice(0, 10)).toBe(
      "2026-12-10",
    );
  });

  it("dia 31 vira o último dia do mês seguinte", () => {
    expect(nextPeriodEnd(new Date("2026-01-31T00:00:00.000Z")).toISOString().slice(0, 10)).toBe(
      "2026-02-28",
    );
  });

  it("teste vencido aparece como pagamento atrasado", () => {
    const trialEnd = new Date("2026-11-01T00:00:00.000Z");
    expect(effectiveStatus("trialing", trialEnd, new Date("2026-11-10T00:00:00.000Z"))).toBe("past_due");
    expect(effectiveStatus("trialing", trialEnd, new Date("2026-10-10T00:00:00.000Z"))).toBe("trialing");
    // Assinatura ativa não volta para atraso só porque a data de teste passou.
    expect(effectiveStatus("active", trialEnd, new Date("2026-11-10T00:00:00.000Z"))).toBe("active");
  });

  it("conta os dias restantes de teste sem ficar negativo", () => {
    const today = new Date("2026-11-01T12:00:00.000Z");
    expect(daysLeftInTrial(new Date("2026-11-08T12:00:00.000Z"), today)).toBe(7);
    expect(daysLeftInTrial(new Date("2026-10-01T12:00:00.000Z"), today)).toBe(0);
    expect(daysLeftInTrial(null, today)).toBeNull();
  });

  it("primeiro vencimento espera o teste acabar", () => {
    const today = new Date("2026-11-03T10:00:00.000Z");
    const trialEnd = new Date("2026-11-17T00:00:00.000Z");
    expect(firstDueDate(trialEnd, today).toISOString().slice(0, 10)).toBe("2026-11-17");
    // Teste já vencido: cobra hoje, não no passado.
    expect(firstDueDate(new Date("2026-10-01T00:00:00.000Z"), today).toISOString().slice(0, 10)).toBe(
      "2026-11-03",
    );
    expect(firstDueDate(null, today).toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("acha o plano pelo código", () => {
    expect(saasPlan("escola")?.range).toContain("81");
    expect(saasPlan("nao-existe")).toBeNull();
  });
});
