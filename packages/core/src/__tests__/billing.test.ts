import { describe, expect, it } from "vitest";
import {
  addCompetences,
  chargeAmount,
  chargeState,
  competenceLabel,
  competenceOf,
  daysInMonth,
  daysLate,
  delinquentStudents,
  monthlyCharge,
  dueDateFor,
  isBillingWindowOpen,
  isCompetence,
  isOverdue,
  outstandingCents,
  parseCompetence,
  summarizeCharges,
  parseIsoDay,
  isoDay,
} from "../billing";

describe("competência", () => {
  it("deriva AAAA-MM de uma data em UTC", () => {
    expect(competenceOf(new Date("2026-11-30T23:00:00.000Z"))).toBe("2026-11");
    expect(competenceOf(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
  });

  it("recusa formato fora de AAAA-MM", () => {
    expect(isCompetence("2026-13")).toBe(false);
    expect(isCompetence("2026-1")).toBe(false);
    expect(isCompetence("11/2026")).toBe(false);
    expect(() => parseCompetence("2026-13")).toThrow(/competência inválida/);
  });

  it("atravessa a virada de ano nos dois sentidos", () => {
    expect(addCompetences("2026-12", 1)).toBe("2027-01");
    expect(addCompetences("2026-01", -1)).toBe("2025-12");
    expect(addCompetences("2026-03", 12)).toBe("2027-03");
    expect(addCompetences("2026-03", 0)).toBe("2026-03");
  });

  it("escreve o mês por extenso em português", () => {
    expect(competenceLabel("2026-03")).toBe("março de 2026");
    expect(competenceLabel("2026-12")).toBe("dezembro de 2026");
  });
});

describe("vencimento", () => {
  it("usa o dia pedido quando ele existe no mês", () => {
    expect(isoDay(dueDateFor("2026-11", 20))).toBe("2026-11-20");
  });

  it("encolhe para o último dia do mês: dia 31 em fevereiro vira 28", () => {
    expect(isoDay(dueDateFor("2026-02", 31))).toBe("2026-02-28");
    expect(isoDay(dueDateFor("2028-02", 31))).toBe("2028-02-29");
    expect(isoDay(dueDateFor("2026-04", 31))).toBe("2026-04-30");
  });

  it("recusa dia fora de 1..31", () => {
    expect(() => dueDateFor("2026-11", 0)).toThrow(/dia de vencimento inválido/);
    expect(() => dueDateFor("2026-11", 32)).toThrow(/dia de vencimento inválido/);
    expect(() => dueDateFor("2026-11", 5.5)).toThrow(/dia de vencimento inválido/);
  });

  it("conta os dias do mês civil", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 6)).toBe(30);
  });
});

describe("janela de cobrança", () => {
  const due = dueDateFor("2026-11", 10);

  it("abre cinco dias antes do vencimento", () => {
    expect(isBillingWindowOpen(due, new Date("2026-11-04T12:00:00Z"))).toBe(false);
    expect(isBillingWindowOpen(due, new Date("2026-11-05T00:00:00Z"))).toBe(true);
  });

  it("continua aberta depois do vencimento: execução perdida é recuperada", () => {
    expect(isBillingWindowOpen(due, new Date("2026-12-01T00:00:00Z"))).toBe(true);
  });

  it("aceita outra antecedência", () => {
    expect(isBillingWindowOpen(due, new Date("2026-11-09T00:00:00Z"), 1)).toBe(true);
    expect(isBillingWindowOpen(due, new Date("2026-11-08T00:00:00Z"), 1)).toBe(false);
  });
});

describe("atraso", () => {
  const today = new Date("2026-11-10T12:00:00.000Z");

  it("não está vencida no próprio dia do vencimento", () => {
    const due = new Date("2026-11-10T00:00:00.000Z");
    expect(isOverdue(due, today)).toBe(false);
    expect(daysLate(due, today)).toBe(0);
  });

  it("conta dias corridos depois do vencimento", () => {
    expect(daysLate(new Date("2026-11-01T00:00:00.000Z"), today)).toBe(9);
    expect(daysLate(new Date("2026-10-10T00:00:00.000Z"), today)).toBe(31);
  });
});

describe("estado da cobrança", () => {
  const today = new Date("2026-11-10T00:00:00.000Z");
  const base = { amount: 45000, status: "open" as const, dueDate: new Date("2026-11-05T00:00:00.000Z") };

  it("vencida sai da data, nunca de uma coluna", () => {
    expect(chargeState(base, today)).toBe("vencida");
    expect(chargeState({ ...base, dueDate: new Date("2026-11-20T00:00:00.000Z") }, today)).toBe("aberta");
    expect(chargeState({ ...base, status: "paid" }, today)).toBe("paga");
    expect(chargeState({ ...base, status: "canceled" }, today)).toBe("cancelada");
  });

  it("não deixa a cobrança no escuro quando o pagamento é maior que o valor", () => {
    expect(outstandingCents({ ...base, paidCents: 50000 })).toBe(0);
    expect(outstandingCents({ ...base, paidCents: 20000 })).toBe(25000);
    expect(outstandingCents({ ...base, status: "paid" })).toBe(0);
    expect(outstandingCents({ ...base, status: "canceled" })).toBe(0);
  });

  it("aplica desconto sem passar de zero", () => {
    expect(chargeAmount(45000, 5000)).toBe(40000);
    expect(chargeAmount(45000, 45000)).toBe(0);
    expect(chargeAmount(45000, 99999)).toBe(0);
    expect(() => chargeAmount(-1)).toThrow(/não pode ser negativo/);
  });
});

describe("mensalidade da competência", () => {
  const monthly = 45000;

  it("cobra o mês inteiro de quem já estava matriculado", () => {
    expect(
      monthlyCharge({
        monthlyAmount: monthly,
        competence: "2026-11",
        startsOn: new Date("2026-02-10T00:00:00.000Z"),
      }),
    ).toBe(45000);
  });

  it("não cobra o mês anterior à matrícula", () => {
    expect(
      monthlyCharge({
        monthlyAmount: monthly,
        competence: "2026-11",
        startsOn: new Date("2026-12-01T00:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("rateia a matrícula no meio do mês", () => {
    // Entra em 16/11: restam 15 de 30 dias → metade.
    const value = monthlyCharge({
      monthlyAmount: monthly,
      discount: 5000,
      competence: "2026-11",
      startsOn: new Date("2026-11-16T00:00:00.000Z"),
    });
    expect(value).toBe(20000);
  });

  it("aplica desconto integral no mês cheio", () => {
    expect(
      monthlyCharge({
        monthlyAmount: monthly,
        discount: 5000,
        competence: "2026-11",
        startsOn: new Date("2026-01-05T00:00:00.000Z"),
      }),
    ).toBe(40000);
  });

  it("sem matrícula informada, cobra o plano cheio", () => {
    expect(monthlyCharge({ monthlyAmount: monthly, competence: "2026-11" })).toBe(45000);
  });
});

describe("resumo do mês", () => {
  const today = new Date("2026-11-10T00:00:00.000Z");

  const charges = [
    { amount: 45000, status: "paid" as const, dueDate: new Date("2026-11-05T00:00:00.000Z") },
    { amount: 45000, status: "open" as const, dueDate: new Date("2026-11-01T00:00:00.000Z") },
    { amount: 45000, status: "open" as const, dueDate: new Date("2026-11-20T00:00:00.000Z") },
    { amount: 30000, status: "open" as const, dueDate: new Date("2026-11-01T00:00:00.000Z"), paidCents: 10000 },
    { amount: 99900, status: "canceled" as const, dueDate: new Date("2026-11-01T00:00:00.000Z") },
  ];

  it("separa recebido, a receber e vencido, ignorando cancelada", () => {
    const summary = summarizeCharges(charges, today);

    expect(summary.billedCents).toBe(165000);
    expect(summary.receivedCents).toBe(55000);
    expect(summary.overdueCents).toBe(65000);
    expect(summary.overdueCount).toBe(2);
    // `openCents` inclui o vencido; o que está no prazo é a diferença.
    expect(summary.openCents).toBe(110000);
    expect(summary.openCents - summary.overdueCents).toBe(45000);
    expect(summary.openCount).toBe(3);
    expect(summary.paidCount).toBe(1);
  });

  it("trata pagamento parcial como saldo em aberto", () => {
    const summary = summarizeCharges(
      [{ amount: 45000, status: "open", dueDate: new Date("2026-11-01T00:00:00.000Z"), paidCents: 40000 }],
      today,
    );
    expect(summary.overdueCents).toBe(5000);
    expect(summary.receivedCents).toBe(40000);
  });
});

describe("inadimplência por aluno", () => {
  const today = new Date("2026-11-10T00:00:00.000Z");

  it("agrupa as parcelas do aluno, do mais atrasado para o menos", () => {
    const list = delinquentStudents(
      [
        { studentId: "a", studentName: "Ana", amount: 45000, status: "open", dueDate: new Date("2026-11-01T00:00:00.000Z") },
        { studentId: "a", studentName: "Ana", amount: 45000, status: "open", dueDate: new Date("2026-10-01T00:00:00.000Z") },
        { studentId: "b", studentName: "Beto", amount: 30000, status: "open", dueDate: new Date("2026-11-08T00:00:00.000Z") },
        { studentId: "c", studentName: "Caio", amount: 45000, status: "paid", dueDate: new Date("2026-10-01T00:00:00.000Z") },
        { studentId: "d", studentName: "Duda", amount: 45000, status: "open", dueDate: new Date("2026-11-20T00:00:00.000Z") },
      ],
      today,
    );

    expect(list.map((entry) => entry.studentId)).toEqual(["a", "b"]);
    expect(list[0]).toMatchObject({ totalCents: 90000, charges: 2, daysLate: 40 });
    expect(list[1]).toMatchObject({ totalCents: 30000, charges: 1, daysLate: 2 });
  });

  it("não considera vencida a cobrança paga, cancelada ou ainda no prazo", () => {
    const list = delinquentStudents(
      [
        { studentId: "a", amount: 45000, status: "canceled", dueDate: new Date("2026-10-01T00:00:00.000Z") },
        { studentId: "b", amount: 45000, status: "paid", dueDate: new Date("2026-10-01T00:00:00.000Z") },
        { studentId: "c", amount: 45000, status: "open", dueDate: new Date("2026-11-20T00:00:00.000Z") },
      ],
      today,
    );
    expect(list).toEqual([]);
  });
});

describe("datas de formulário", () => {
  it("vai e volta sem sair do dia", () => {
    expect(isoDay(new Date("2026-11-20T00:00:00.000Z"))).toBe("2026-11-20");
    expect(isoDay(parseIsoDay("2026-11-20")!)).toBe("2026-11-20");
    expect(parseIsoDay("20/11/2026")).toBeNull();
  });
});
