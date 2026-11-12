"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@nextgen/db";
import { competenceLabel, formatBRL, isCompetence, pixPayload, toCents } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { runMonthlyBilling } from "@/lib/billing-run";
import { sendInvoiceEmail } from "@/lib/invoice-email";

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

  if (!name) return fail("Dê um nome ao plano (por exemplo, Mensalidade 3x semana).");
  if (!amount) return fail("Informe o valor mensal, como 450,00.");

  try {
    await withTenant(
      { schoolId: context.workspace.schoolId, userId: context.session.userId },
      async (tx) => {
        const plan = await tx.tuitionPlan.create({
          data: { schoolId: context.workspace.schoolId, name, monthlyAmount: amount },
        });
        await tx.auditLog.create({
          data: {
            schoolId: context.workspace.schoolId,
            actorUserId: context.session.userId,
            actorRole: context.workspace.role ?? "admin",
            action: "tuition_plan.create",
            entity: "tuition_plan",
            entityId: plan.id,
            after: { name, monthlyAmount: amount },
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
  return ok(`Plano "${name}" criado: ${formatBRL(amount)} por mês.`);
}

/**
 * Gera as mensalidades da competência a partir do dia de vencimento de cada aluno.
 *
 * O caminho normal é o cron (`/api/cron/mensalidades`), que só cobra quem já entrou na
 * janela do vencimento. Este botão existe para a secretaria antecipar o mês inteiro ou
 * recuperar um mês que passou.
 */
export async function generateMonth(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola gera mensalidade.");

  const competence = text(formData, "competence");
  if (!isCompetence(competence)) return fail("Escolha o mês no formato AAAA-MM.");

  const result = await runMonthlyBilling(
    { schoolId: context.workspace.schoolId, userId: context.session.userId },
    // `notify` fica ligado também no botão manual: assim a escola que ainda não configurou
    // o cron consegue entregar o PIX de quem venceu hoje. A janela interna evita mandar
    // aviso de competência antecipada.
    { competence, onlyDueSoon: false, notify: true },
  );

  refresh();

  if (result.created === 0 && result.alreadyThere === 0) {
    return fail(
      "Nenhum aluno com plano e matrícula ativa. Defina o plano do aluno antes de gerar o mês.",
    );
  }

  const label = competenceLabel(competence);
  if (result.created === 0) {
    return ok(`Nada a fazer: ${label} já estava gerado para todos os alunos.`);
  }

  const skipped = result.alreadyThere > 0 ? ` ${result.alreadyThere} já existia(m).` : "";
  const invited =
    result.emailed > 0 ? ` ${result.emailed} e-mail(s) de cobrança enviado(s).` : "";
  return ok(`${result.created} mensalidade(s) de ${label} gerada(s).${skipped}${invited}`);
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

/** Reenvio manual da cobrança. Falha de e-mail não desfaz a cobrança. */
export async function emailInvoice(_prev: FinanceState, formData: FormData): Promise<FinanceState> {
  const context = await cashier();
  if (!context) return fail("Só a administração da escola envia cobrança.");

  const invoiceId = text(formData, "invoiceId");
  if (!invoiceId) return fail("Cobrança não identificada.");

  let result: Awaited<ReturnType<typeof sendInvoiceEmail>>;
  try {
    result = await sendInvoiceEmail(
      { schoolId: context.workspace.schoolId, userId: context.session.userId },
      { invoiceId, force: true },
    );
  } catch {
    return fail("O provedor de e-mail recusou o envio. A cobrança continua em aberto para reenvio.");
  }

  if (result.status === "sent") return ok(`Cobrança enviada para o responsável de ${result.studentName}.`);
  if (result.reason === "already_notified") return ok("Esta cobrança já havia sido enviada.");
  if (result.reason === "canceled") return fail("Cobrança cancelada não é enviada.");
  return fail(
    "Não encontrei responsável financeiro com e-mail nesta cobrança. Cadastre o responsável antes de enviar.",
  );
}
