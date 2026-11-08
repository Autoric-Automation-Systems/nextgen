import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY,
  deliveryDateFor,
  deliveryHint,
  describeDelivery,
  isValidSendDay,
  normalizeSendDay,
  shouldDeliverToday,
} from "../dunning";

const competencia = "2026-11";
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("deliveryDateFor", () => {
  it("devolve a data do envio dentro da competência", () => {
    expect(deliveryDateFor(competencia, 5).toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("prende o dia ao último dia do mês", () => {
    expect(deliveryDateFor("2026-02", 28).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("recusa dia fora de 1..28", () => {
    expect(() => deliveryDateFor(competencia, 0)).toThrow(/dia de envio inválido/);
    expect(() => deliveryDateFor(competencia, 31)).toThrow(/dia de envio inválido/);
  });
});

describe("shouldDeliverToday", () => {
  const settings = { automatic: true, sendDay: 5 };

  it("não envia antes do dia combinado", () => {
    expect(
      shouldDeliverToday({ settings, competence: competencia, lastSentAt: null, today: dia("2026-11-04") }),
    ).toBe(false);
  });

  it("envia no dia combinado, uma vez", () => {
    const input = { settings, competence: competencia, today: dia("2026-11-05") };
    expect(shouldDeliverToday({ ...input, lastSentAt: null })).toBe(true);
    expect(shouldDeliverToday({ ...input, lastSentAt: dia("2026-11-05") })).toBe(false);
  });

  it("alcança a cobrança depois do dia, quando o job não rodou", () => {
    // Dia 5 caiu no domingo: perder o envio por causa do calendário é pior que atrasar.
    expect(
      shouldDeliverToday({ settings, competence: competencia, lastSentAt: null, today: dia("2026-11-08") }),
    ).toBe(true);
  });

  it("não reenvia dentro do mesmo ciclo só porque o dia mudou", () => {
    expect(
      shouldDeliverToday({
        settings: { automatic: true, sendDay: 20 },
        competence: competencia,
        lastSentAt: dia("2026-11-05"),
        today: dia("2026-11-21"),
      }),
    ).toBe(false);
  });

  it("respeita envio manual, cobrança paga e cobrança cancelada", () => {
    const base = { competence: competencia, lastSentAt: null, today: dia("2026-11-10") };
    expect(shouldDeliverToday({ ...base, settings: DEFAULT_DELIVERY })).toBe(false);
    expect(shouldDeliverToday({ ...base, settings, paid: true })).toBe(false);
    expect(shouldDeliverToday({ ...base, settings, canceled: true })).toBe(false);
  });
});

describe("configuração de envio", () => {
  it("normaliza dia inválido para o padrão", () => {
    expect(normalizeSendDay(31)).toBe(DEFAULT_DELIVERY.sendDay);
    expect(normalizeSendDay(null)).toBe(DEFAULT_DELIVERY.sendDay);
    expect(normalizeSendDay(10)).toBe(10);
  });

  it("valida o limite de 28", () => {
    expect(isValidSendDay(28)).toBe(true);
    expect(isValidSendDay(29)).toBe(false);
  });

  it("avisa quando o envio sai depois do vencimento", () => {
    expect(deliveryHint({ automatic: true, sendDay: 20 }, 10)).toMatch(/depois do vencimento/);
    expect(deliveryHint({ automatic: true, sendDay: 3 }, 10)).toBeNull();
    expect(deliveryHint(DEFAULT_DELIVERY, 10)).toMatch(/botão/);
  });

  it("descreve a configuração para a tela", () => {
    expect(describeDelivery({ automatic: true, sendDay: 7 })).toContain("dia 7");
    expect(describeDelivery(DEFAULT_DELIVERY)).toContain("manual");
  });
});
