"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@nextgen/db";
import {
  DEFAULT_DELIVERY,
  MAX_SEND_DAY,
  competenceLabel,
  dueDateFor,
  formatBRL,
  isCompetence,
  isValidSendDay,
  monthlyCharge,
  pixPayload,
  toCents,
} from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { SEND_FAILURE_MESSAGE, sendInvoiceEmail } from "@/lib/invoice-mail";

export type FinanceState = { status: "idle" | "ok" | "error"; message?: string };

const ok = (message: string): FinanceState => ({ status: "ok", message });
const fail = (message: string): FinanceState => ({ status: "error", message });

async function cashier() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || workspace.readOnly || !workspace.can("charge:write")) return null;
  return { session, workspace };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function cents(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  try {
    const value = toCents(raw);
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function day(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

function isoDayOrNull(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function refresh() {
  revalidatePath("/financeiro");
  revalidatePath("/meus-boletos");
}

export async function createPlan(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola cria plano de cobrança.");

  const name = text(formData, "name");
  const amount = cents(formData, "monthlyAmount");
  const dueDay = day(text(formData, "dueDay"));

  if (!name) return fail("Dê um nome ao plano (por exemplo, Mensalidade 3x semana).");
  if (!amount) return fail("Informe o valor mensal, como 450,00.");
  if (!dueDay) return fail("O dia de vencimento precisa estar entre 1 e 31.");

  try {
    await withTenant(
      { schoolId: context.workspace.schoolId, userId: context.session.userId },
      async (tx) => {
        const plan = await tx.tuitionPlan.create({
          data: { schoolId: context.workspace.schoolId, name, monthlyAmount: amount, dueDay },
        });
        await tx.auditLog.create({
          data: {
            schoolId: context.workspace.schoolId,
            actorUserId: context.session.userId,
            actorRole: context.workspace.role ?? "admin",
            action: "tuition_plan.create",
            entity: "tuition_plan",
            entityId: plan.id,
            after: { name, monthlyAmount: amount, dueDay },
          },
        });
      },
    );
  } catch (error) {
    if (String(error).includes("Unique constraint")) {
      return fail(`Já existe um plano chamado "${name}".`);
    }
    throw error;
  }

  refresh();
  return ok(`Plano "${name}" criado: ${formatBRL(amount)} todo dia ${dueDay}.`);
}

/**
 * Gera as mensalidades da competência.
 *
 * Idempotente por construção: o índice único `(student_id, competence, kind)` faz o
 * `skipDuplicates` ignorar quem já foi cobrado. Clicar duas vezes não duplica cobrança.
 */
export async function generateMonth(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola gera mensalidade.");

  const competence = text(formData, "competence");
  if (!isCompetence(competence)) return fail("Escolha o mês no formato AAAA-MM.");

  const result = await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      const students = await tx.student.findMany({
        where: {
          status: "active",
          deletedAt: null,
          tuitionPlanId: { not: null },
          enrollments: { some: { status: "active" } },
        },
        select: {
          id: true,
          tuitionPlan: { select: { id: true, monthlyAmount: true, dueDay: true } },
          enrollments: {
            where: { status: "active" },
            orderBy: { startsOn: "desc" },
            take: 1,
            select: { dueDay: true, discountCents: true, startsOn: true },
          },
          guardians: {
            where: { isFinancial: true },
            take: 1,
            select: { guardianId: true },
          },
        },
      });

      const rows = students.flatMap((student) => {
        const plan = student.tuitionPlan;
        const enrollment = student.enrollments[0];
        if (!plan) return [];

        const amount = monthlyCharge({
          monthlyAmount: plan.monthlyAmount,
          discount: enrollment?.discountCents ?? 0,
          competence,
          startsOn: enrollment?.startsOn ?? null,
        });
        if (amount === null) return [];

        const dueDay = enrollment?.dueDay ?? plan.dueDay;
        return [
          {
            schoolId: context.workspace.schoolId,
            studentId: student.id,
            guardianId: student.guardians[0]?.guardianId ?? null,
            planId: plan.id,
            kind: "monthly" as const,
            competence,
            dueDate: dueDateFor(competence, dueDay),
            amount,
            baseAmount: plan.monthlyAmount,
            discount: Math.max(0, plan.monthlyAmount - amount),
          },
        ];
      });

      if (rows.length === 0) return { created: 0, skipped: 0, empty: true };

      const created = await tx.invoice.createMany({ data: rows, skipDuplicates: true });
      return { created: created.count, skipped: rows.length - created.count, empty: false };
    },
  );

  refresh();

  if (result.empty) {
    return fail(
      "Nenhum aluno com plano e matrícula ativa. Defina o plano do aluno antes de gerar o mês.",
    );
  }

  const label = competenceLabel(competence);
  if (result.created === 0) {
    return ok(`Nada a fazer: ${label} já estava gerado para todos os alunos.`);
  }

  const skipped = result.skipped > 0 ? ` ${result.skipped} já existia(m).` : "";
  return ok(`${result.created} mensalidade(s) de ${label} gerada(s).${skipped}`);
}

export async function registerPayment(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola registra pagamento.");

  const invoiceId = text(formData, "invoiceId");
  const method = text(formData, "method") || "pix";
  const paidAt = isoDayOrNull(text(formData, "paidAt")) ?? new Date();
  const typed = cents(formData, "amount");

  if (!invoiceId) return fail("Cobrança não identificada.");

  const message = await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId },
        include: { payments: { select: { amount: true } } },
      });
      if (!invoice) return fail("Cobrança não encontrada nesta escola.");
      if (invoice.status === "canceled") return fail("Cobrança cancelada não recebe pagamento.");

      const paid = invoice.payments.reduce((total, payment) => total + payment.amount, 0);
      const outstanding = Math.max(0, invoice.amount - paid);
      if (outstanding === 0) return fail("Esta cobrança já está quitada.");

      const amount = typed ?? outstanding;
      if (amount > outstanding) {
        return fail(
          `O valor passa do saldo de ${formatBRL(outstanding)}. Registre o excedente em outra cobrança.`,
        );
      }

      await tx.invoicePayment.create({
        data: {
          schoolId: context.workspace.schoolId,
          invoiceId,
          amount,
          method: method as "pix",
          paidAt,
          actorUserId: context.session.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: context.workspace.schoolId,
          actorUserId: context.session.userId,
          actorRole: context.workspace.role ?? "admin",
          action: "invoice.payment",
          entity: "invoice",
          entityId: invoiceId,
          after: { amount, method, paidAt: paidAt.toISOString().slice(0, 10) },
        },
      });

      if (paid + amount >= invoice.amount) {
        await tx.invoice.update({ where: { id: invoiceId }, data: { status: "paid" } });
        return ok(`Pagamento de ${formatBRL(amount)} registrado. Cobrança quitada.`);
      }

      return ok(
        `Pagamento parcial de ${formatBRL(amount)} registrado. Saldo: ${formatBRL(
          invoice.amount - paid - amount,
        )}.`,
      );
    },
  );

  refresh();
  return message;
}

export async function cancelInvoice(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola cancela cobrança.");

  const invoiceId = text(formData, "invoiceId");
  if (!invoiceId) return fail("Cobrança não identificada.");

  const result = await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId },
        include: { payments: { select: { amount: true } } },
      });
      if (!invoice) return fail("Cobrança não encontrada nesta escola.");
      if (invoice.status === "canceled") return fail("Esta cobrança já está cancelada.");

      const paid = invoice.payments.reduce((total, payment) => total + payment.amount, 0);
      if (paid > 0) {
        return fail("Cobrança com pagamento lançado não pode ser cancelada: estorne o valor primeiro.");
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "canceled", canceledAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          schoolId: context.workspace.schoolId,
          actorUserId: context.session.userId,
          actorRole: context.workspace.role ?? "admin",
          action: "invoice.cancel",
          entity: "invoice",
          entityId: invoiceId,
          after: { amount: invoice.amount, competence: invoice.competence },
        },
      });

      return ok("Cobrança cancelada.");
    },
  );

  refresh();
  return result;
}

export async function createExpense(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola lança despesa.");

  const category = text(formData, "category") || "outros";
  const description = text(formData, "description");
  const amount = cents(formData, "amount");
  const dueDate = isoDayOrNull(text(formData, "dueDate"));
  const supplier = text(formData, "supplier") || null;

  if (!description) return fail("Descreva a despesa.");
  if (!amount) return fail("Informe o valor da despesa.");
  if (!dueDate) return fail("Informe a data de vencimento da despesa.");

  await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      const expense = await tx.expense.create({
        data: {
          schoolId: context.workspace.schoolId,
          category,
          description,
          amount,
          dueDate,
          supplier,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: context.workspace.schoolId,
          actorUserId: context.session.userId,
          actorRole: context.workspace.role ?? "admin",
          action: "expense.create",
          entity: "expense",
          entityId: expense.id,
          after: { amount, category },
        },
      });
    },
  );

  refresh();
  return ok(`Despesa de ${formatBRL(amount)} lançada.`);
}

export async function payExpense(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola baixa despesa.");

  const expenseId = text(formData, "expenseId");
  if (!expenseId) return fail("Despesa não identificada.");

  const paid = await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      const result = await tx.expense.updateMany({
        where: { id: expenseId, paidAt: null, deletedAt: null },
        data: { paidAt: new Date() },
      });
      return result.count;
    },
  );

  refresh();
  return paid === 0 ? fail("Despesa já baixada ou inexistente.") : ok("Despesa marcada como paga.");
}

export async function savePixSettings(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola altera a chave Pix.");

  const key = text(formData, "pixKey");
  const holder = text(formData, "pixHolder");
  const city = text(formData, "pixCity");

  if (!key) return fail("Informe a chave Pix da escola.");
  if (!holder) return fail("Informe o nome do titular da conta.");

  try {
    // Payload de teste: chave com formato estranho aparece aqui, não no e-mail do
    // responsável. O valor é fictício e não é salvo.
    pixPayload({ key, holder, city: city || "Brasil", amountCents: 100, txid: "TESTE" });
  } catch {
    return fail("Não foi possível montar o Pix com essa chave. Confira o formato.");
  }

  await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    async (tx) => {
      await tx.school.updateMany({
        data: { pixKey: key, pixHolder: holder, pixCity: city || "Brasil" },
      });
    },
  );

  refresh();
  return ok("Chave Pix salva. O copia e cola já sai com ela.");
}

/**
 * Envia a cobrança por e-mail ao responsável financeiro.
 *
 * Falha de e-mail não desfaz a cobrança: a mensagem aparece na tela e a linha continua
 * lá para reenvio. O botão é sempre um reenvio explícito (`force`), ao contrário do job
 * do dia combinado, que só manda uma vez por competência.
 */
export async function emailInvoice(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola envia cobrança.");

  const invoiceId = text(formData, "invoiceId");
  if (!invoiceId) return fail("Cobrança não identificada.");

  const result = await sendInvoiceEmail(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    invoiceId,
    { force: true },
  );

  return result.ok
    ? ok(`Cobrança enviada para ${result.to}.`)
    : fail(SEND_FAILURE_MESSAGE[result.reason]);
}

/** Liga ou desliga o envio automático e escolhe o dia do mês. */
export async function saveDeliverySettings(
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola muda o envio de cobrança.");

  const automatic = text(formData, "automatic") === "on";
  const sendDay = Number.parseInt(text(formData, "sendDay"), 10);

  if (automatic && !isValidSendDay(sendDay)) {
    return fail(`Escolha um dia entre 1 e ${MAX_SEND_DAY}.`);
  }

  await withTenant(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    (tx) =>
      tx.school.update({
        where: { id: context.workspace.schoolId },
        data: {
          invoiceSendAutomatic: automatic,
          invoiceSendDay: isValidSendDay(sendDay) ? sendDay : DEFAULT_DELIVERY.sendDay,
        },
      }),
  );

  refresh();
  return ok(
    automatic
      ? `Envio automático ligado para o dia ${sendDay} de cada mês.`
      : "Envio automático desligado. A cobrança sai pelo botão de cada linha.",
  );
}
