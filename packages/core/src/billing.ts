/**
 * Regras de cobrança (doc 07).
 *
 * Duas decisões estruturais moram aqui:
 *
 * 1. Competência é texto `AAAA-MM`, nunca a data do vencimento. "Novembro/2026" existe
 *    antes de a escola escolher o dia 5, 10 ou 20 — e a mesma competência pode ter mais
 *    de um vencimento (mensalidade + material).
 * 2. "Vencida" é derivado de `dueDate`, não gravado. Ver `chargeState`.
 */

import { applyDiscount, prorateMonthly, type Cents } from "./money";

/** `AAAA-MM`. Ordena como string, o que serve para relatório mensal. */
export type Competence = string;

const COMPETENCE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function competenceOf(date: Date): Competence {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function parseCompetence(value: string): { year: number; month: number } {
  const match = COMPETENCE.exec(value);
  if (!match) throw new Error(`competência inválida: ${value} (use AAAA-MM)`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isCompetence(value: string): boolean {
  return COMPETENCE.test(value);
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-11" → "novembro de 2026". */
export function competenceLabel(value: Competence): string {
  const { year, month } = parseCompetence(value);
  return `${MONTHS[month - 1]} de ${year}`;
}

export function addCompetences(value: Competence, delta: number): Competence {
  const { year, month } = parseCompetence(value);
  const zeroBased = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBased / 12);
  const nextMonth = (zeroBased % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Vencimento da competência no dia pedido.
 *
 * Dia 31 em fevereiro vira o último dia do mês: a alternativa é falhar na geração de
 * fevereiro, ou pular para o mês seguinte e cobrar fora da competência.
 */
export function dueDateFor(value: Competence, dueDay: number): Date {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error(`dia de vencimento inválido: ${dueDay}`);
  }
  const { year, month } = parseCompetence(value);
  const day = Math.min(dueDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Meia-noite UTC de hoje. Comparação de dinheiro não pode depender de fuso. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function isOverdue(dueDate: Date, today: Date = todayUtc()): boolean {
  return dayNumber(today) > dayNumber(dueDate);
}

/** Dias corridos de atraso; zero quando ainda não venceu. */
export function daysLate(dueDate: Date, today: Date = todayUtc()): number {
  return Math.max(0, dayNumber(today) - dayNumber(dueDate));
}

/**
 * Comparação por dia civil, não por instante: um vencimento às 00:00 e um "agora" às
 * 14:00 são o mesmo dia, e a cobrança não está vencida.
 */
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export type ChargeStatus = "open" | "paid" | "canceled";

/** Tipo da cobrança, espelhando o enum `charge_kind` do banco. */
export type ChargeKind = "monthly" | "enrollment" | "material" | "uniform" | "other";

/** O que a escola vê na lista. `vencida` nunca é gravada — sai da data. */
export type ChargeState = "paga" | "aberta" | "vencida" | "cancelada";

export type ChargeLike = {
  amount: Cents;
  status: ChargeStatus;
  dueDate: Date;
  /** Soma dos pagamentos lançados. Ausente conta como zero. */
  paidCents?: Cents;
};

export function chargeState(charge: ChargeLike, today: Date = todayUtc()): ChargeState {
  if (charge.status === "canceled") return "cancelada";
  if (charge.status === "paid") return "paga";
  return isOverdue(charge.dueDate, today) ? "vencida" : "aberta";
}

/** Quanto ainda falta receber. Pagamento a mais não vira saldo negativo. */
export function outstandingCents(charge: ChargeLike): Cents {
  if (charge.status === "canceled") return 0;
  const paid = charge.paidCents ?? (charge.status === "paid" ? charge.amount : 0);
  return Math.max(0, charge.amount - paid);
}

export type BillingSummary = {
  /** Soma das cobranças válidas (não canceladas). */
  billedCents: Cents;
  receivedCents: Cents;
  /** Tudo que ainda falta receber, incluindo o que já venceu. */
  openCents: Cents;
  /** Parte vencida de `openCents`. O que está no prazo é `openCents - overdueCents`. */
  overdueCents: Cents;
  overdueCount: number;
  paidCount: number;
  /** Cobranças com saldo, vencidas ou não. */
  openCount: number;
};

export function summarizeCharges(charges: ChargeLike[], today: Date = todayUtc()): BillingSummary {
  const summary: BillingSummary = {
    billedCents: 0,
    receivedCents: 0,
    openCents: 0,
    overdueCents: 0,
    overdueCount: 0,
    paidCount: 0,
    openCount: 0,
  };

  for (const charge of charges) {
    if (charge.status === "canceled") continue;
    summary.billedCents += charge.amount;
    summary.receivedCents += charge.status === "paid" ? charge.amount : (charge.paidCents ?? 0);

    const state = chargeState(charge, today);
    if (state === "paga") {
      summary.paidCount += 1;
      continue;
    }

    const open = outstandingCents(charge);
    if (open === 0) continue;

    summary.openCents += open;
    summary.openCount += 1;
    if (state === "vencida") {
      summary.overdueCents += open;
      summary.overdueCount += 1;
    }
  }

  return summary;
}

export type DelinquentStudent = {
  studentId: string;
  studentName?: string;
  totalCents: Cents;
  charges: number;
  /** Vencimento mais antigo: é ele que define a urgência da cobrança. */
  oldestDueDate: Date;
  daysLate: number;
};

/**
 * Inadimplência por aluno, do mais atrasado para o menos.
 *
 * Agrupa por aluno porque a régua de cobrança fala com o responsável, não com a
 * mensalidade: "são 3 parcelas, R$ 750" resolve; "3 boletos" gera três ligações.
 */
export function delinquentStudents(
  charges: (ChargeLike & { studentId: string; studentName?: string })[],
  today: Date = todayUtc(),
): DelinquentStudent[] {
  const byStudent = new Map<string, DelinquentStudent>();

  for (const charge of charges) {
    const outstanding = outstandingCents(charge);
    if (outstanding === 0) continue;
    if (chargeState(charge, today) !== "vencida") continue;

    const current = byStudent.get(charge.studentId);
    if (!current) {
      byStudent.set(charge.studentId, {
        studentId: charge.studentId,
        studentName: charge.studentName,
        totalCents: outstanding,
        charges: 1,
        oldestDueDate: charge.dueDate,
        daysLate: daysLate(charge.dueDate, today),
      });
      continue;
    }

    current.totalCents += outstanding;
    current.charges += 1;
    if (charge.dueDate < current.oldestDueDate) current.oldestDueDate = charge.dueDate;
    current.daysLate = daysLate(current.oldestDueDate, today);
  }

  return [...byStudent.values()].sort(
    (a, b) => b.daysLate - a.daysLate || b.totalCents - a.totalCents,
  );
}

/**
 * Mensalidade de um aluno na competência.
 *
 * `null` quando a matrícula começa depois do mês: cobrar novembro de quem entra em
 * dezembro é o erro que mais gera estorno na secretaria. Matrícula no meio do mês paga
 * proporcional aos dias corridos, e o desconto acompanha a mesma proporção.
 */
export function monthlyCharge(input: {
  monthlyAmount: Cents;
  discount?: Cents;
  competence: Competence;
  startsOn?: Date | null;
}): Cents | null {
  const { monthlyAmount, discount = 0, competence, startsOn } = input;

  if (startsOn) {
    const start = competenceOf(startsOn);
    if (start > competence) return null;

    if (start === competence) {
      const { year, month } = parseCompetence(competence);
      const startDay = startsOn.getUTCDate();
      const size = daysInMonth(year, month);
      return chargeAmount(
        prorateMonthly(monthlyAmount, startDay, size),
        prorateMonthly(discount, startDay, size),
      );
    }
  }

  return chargeAmount(monthlyAmount, discount);
}

/** Valor final da cobrança, com desconto aplicado e nunca negativo. */
export function chargeAmount(baseAmount: Cents, discount: Cents = 0): Cents {
  if (baseAmount < 0) throw new Error("valor da cobrança não pode ser negativo");
  return applyDiscount(baseAmount, discount);
}

/** `AAAA-MM-DD` para `input type="date"`, sem passar por fuso. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
