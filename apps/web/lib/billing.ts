import { withTenant } from "@nextgen/db";
import {
  chargeState,
  competenceOf,
  delinquentStudents,
  summarizeCharges,
  type BillingSummary,
  type ChargeState,
  type DelinquentStudent,
  type ChargeKind,
} from "@nextgen/core";

export type TenantContext = { schoolId: string; userId: string };

export type PlanRow = {
  id: string;
  name: string;
  monthlyAmount: number;
  dueDay: number;
  active: boolean;
  students: number;
};

export type InvoiceRow = {
  id: string;
  studentId: string;
  studentName: string;
  kind: ChargeKind;
  competence: string;
  dueDate: Date;
  amount: number;
  baseAmount: number;
  discount: number;
  status: "open" | "paid" | "canceled";
  paidCents: number;
  state: ChargeState;
  guardianName: string | null;
  /** Último envio ao responsável; `null` = nunca enviada. */
  lastSentAt: Date | null;
};

export type ExpenseRow = {
  id: string;
  category: string;
  description: string;
  amount: number;
  dueDate: Date;
  paidAt: Date | null;
  supplier: string | null;
};

export type PixSettings = {
  key: string | null;
  holder: string | null;
  city: string | null;
};

export type FinanceOverview = {
  competence: string;
  summary: BillingSummary;
  /** Despesas do mês, pagas ou não. */
  expenseCents: number;
  expensePaidCents: number;
  expenses: ExpenseRow[];
  invoices: InvoiceRow[];
  delinquents: DelinquentStudent[];
  plans: PlanRow[];
  pix: PixSettings;
  /** Alunos ativos com plano — o universo que a geração da competência alcança. */
  billableStudents: number;
};

export function currentCompetence(): string {
  return competenceOf(new Date());
}

async function invoiceRows(ctx: TenantContext, where: Record<string, unknown>) {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.invoice.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: {
        student: { select: { fullName: true } },
        payments: { select: { amount: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      studentName: row.student.fullName,
      kind: row.kind,
      competence: row.competence,
      dueDate: row.dueDate,
      amount: row.amount,
      baseAmount: row.baseAmount,
      discount: row.discount,
      status: row.status,
      paidCents: row.payments.reduce((total, payment) => total + payment.amount, 0),
      guardianName: null,
      lastSentAt: row.lastSentAt,
    }));
  });
}

function withState(rows: Omit<InvoiceRow, "state">[]): InvoiceRow[] {
  const today = new Date();
  return rows.map((row) => ({ ...row, state: chargeState(row, today) }));
}

export async function listPlans(ctx: TenantContext): Promise<PlanRow[]> {
  return withTenant(ctx, async (tx) => {
    const plans = await tx.tuitionPlan.findMany({
      where: { deletedAt: null },
      orderBy: [{ active: "desc" }, { dueDay: "asc" }, { name: "asc" }],
      include: { _count: { select: { students: true } } },
    });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      monthlyAmount: plan.monthlyAmount,
      dueDay: plan.dueDay,
      active: plan.active,
      students: plan._count.students,
    }));
  });
}

export async function getPixSettings(ctx: TenantContext): Promise<PixSettings> {
  return withTenant(ctx, async (tx) => {
    const school = await tx.school.findFirst({
      select: { pixKey: true, pixHolder: true, pixCity: true },
    });
    return { key: school?.pixKey ?? null, holder: school?.pixHolder ?? null, city: school?.pixCity ?? null };
  });
}

function monthRange(competence: string): { start: Date; end: Date } {
  const start = new Date(`${competence}-01T00:00:00.000Z`);
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

/** Cobranças da competência, já com o estado calculado (aberta, vencida, paga, cancelada). */
export async function listCompetenceInvoices(
  ctx: TenantContext,
  competence: string,
): Promise<InvoiceRow[]> {
  return withState(await invoiceRows(ctx, { competence }));
}

export async function listExpenses(ctx: TenantContext, competence: string): Promise<ExpenseRow[]> {
  const { start, end } = monthRange(competence);
  const expenses = await withTenant(ctx, (tx) =>
    tx.expense.findMany({
      where: { deletedAt: null, dueDate: { gte: start, lt: end } },
      orderBy: { dueDate: "asc" },
    }),
  );

  return expenses.map((expense) => ({
    id: expense.id,
    category: expense.category,
    description: expense.description,
    amount: expense.amount,
    dueDate: expense.dueDate,
    paidAt: expense.paidAt,
    supplier: expense.supplier,
  }));
}

/** Alunos que gerariam cobrança: ativos, com plano e matrícula ativa. */
export async function countBillableStudents(ctx: TenantContext): Promise<number> {
  return withTenant(ctx, (tx) =>
    tx.student.count({
      where: {
        status: "active",
        deletedAt: null,
        tuitionPlanId: { not: null },
        enrollments: { some: { status: "active" } },
      },
    }),
  );
}

export function expenseTotals(expenses: ExpenseRow[]): { total: number; paid: number } {
  return {
    total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    paid: expenses
      .filter((expense) => expense.paidAt !== null)
      .reduce((sum, expense) => sum + expense.amount, 0),
  };
}

export async function getFinanceOverview(
  ctx: TenantContext,
  competence: string,
): Promise<FinanceOverview> {
  const [plans, pix, expenseRows, rows, billableStudents] = await Promise.all([
    listPlans(ctx),
    getPixSettings(ctx),
    listExpenses(ctx, competence),
    listCompetenceInvoices(ctx, competence),
    countBillableStudents(ctx),
  ]);

  const { total: expenseCents, paid: expensePaidCents } = expenseTotals(expenseRows);

  return {
    competence,
    summary: summarizeCharges(rows),
    expenseCents,
    expensePaidCents,
    expenses: expenseRows,
    invoices: rows,
    delinquents: delinquentStudents(rows),
    plans,
    pix,
    billableStudents,
  };
}

/**
 * Cobranças visíveis para o responsável.
 *
 * A RLS isola escola, não papel: sem o filtro por `studentIds`, um responsável leria a
 * mensalidade de todos os alunos da escola.
 */
export async function listGuardianInvoices(
  ctx: TenantContext,
  studentIds: string[],
): Promise<InvoiceRow[]> {
  if (studentIds.length === 0) return [];
  const rows = await invoiceRows(ctx, { studentId: { in: studentIds } });
  return withState(rows).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
}

export async function getGuardianPix(ctx: TenantContext): Promise<PixSettings> {
  return getPixSettings(ctx);
}
