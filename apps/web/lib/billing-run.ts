import { withTenant } from "@nextgen/db";
import {
  dueDateFor,
  isBillingWindowOpen,
  monthlyCharge,
  todayUtc,
  type Competence,
} from "@nextgen/core";
import { sendInvoiceEmail } from "./invoice-email";

export type BillingRunResult = {
  created: number;
  alreadyThere: number;
  emailed: number;
  emailSkipped: number;
  emailFailed: number;
};

export type BillingRunOptions = {
  competence: Competence;
  today?: Date;
  /**
   * Só cobra quem já entrou na janela do vencimento. O cron usa `true`; o botão manual
   * da escola usa `false`, porque a secretaria quer poder antecipar um mês inteiro.
   */
  onlyDueSoon?: boolean;
  /** Envia o PIX por e-mail para as cobranças ainda não notificadas. */
  notify?: boolean;
};

/**
 * Gera as mensalidades da competência e, opcionalmente, envia o PIX ao responsável.
 *
 * Idempotente por dois mecanismos independentes: o índice único
 * `(student_id, competence, kind)` impede cobrança duplicada (`skipDuplicates`) e
 * `invoices.notified_at` impede e-mail repetido. Rodar de hora em hora não incomoda
 * ninguém; rodar duas vezes no dia não cobra nem avisa duas vezes.
 */
export async function runMonthlyBilling(
  ctx: { schoolId: string; userId?: string | null },
  options: BillingRunOptions,
): Promise<BillingRunResult> {
  const today = options.today ?? todayUtc();
  const { competence, onlyDueSoon = false, notify = false } = options;

  const created = await withTenant(ctx, async (tx) => {
    const students = await tx.student.findMany({
      where: {
        status: "active",
        deletedAt: null,
        tuitionPlanId: { not: null },
        enrollments: { some: { status: "active", deletedAt: null } },
      },
      select: {
        id: true,
        dueDay: true,
        tuitionPlan: { select: { id: true, monthlyAmount: true } },
        enrollments: {
          where: { status: "active", deletedAt: null },
          orderBy: { startsOn: "desc" },
          take: 1,
          select: { discountCents: true, startsOn: true },
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
      if (!plan) return [];

      const dueDate = dueDateFor(competence, student.dueDay);
      if (onlyDueSoon && !isBillingWindowOpen(dueDate, today)) return [];

      const amount = monthlyCharge({
        monthlyAmount: plan.monthlyAmount,
        discount: student.enrollments[0]?.discountCents ?? 0,
        competence,
        startsOn: student.enrollments[0]?.startsOn ?? null,
      });
      if (amount === null) return [];

      return [
        {
          schoolId: ctx.schoolId,
          studentId: student.id,
          guardianId: student.guardians[0]?.guardianId ?? null,
          planId: plan.id,
          kind: "monthly" as const,
          competence,
          dueDate,
          amount,
          baseAmount: plan.monthlyAmount,
          discount: Math.max(0, plan.monthlyAmount - amount),
        },
      ];
    });

    if (rows.length === 0) return { created: 0, pending: 0 };

    const result = await tx.invoice.createMany({ data: rows, skipDuplicates: true });
    return { created: result.count, pending: rows.length - result.count };
  });

  const result: BillingRunResult = {
    created: created.created,
    alreadyThere: created.pending,
    emailed: 0,
    emailSkipped: 0,
    emailFailed: 0,
  };

  if (!notify) return result;

  const pending = await withTenant(ctx, (tx) =>
    tx.invoice.findMany({
      where: { competence, status: "open", notifiedAt: null },
      orderBy: { dueDate: "asc" },
      select: { id: true, dueDate: true },
    }),
  );

  for (const invoice of pending) {
    // Aviso segue a janela do vencimento mesmo quando a geração é manual: competência
    // antecipada espera o vencimento em vez de virar e-mail perdido três semanas antes.
    // Depois do vencimento a janela continua aberta, o que cobre a cobrança atrasada.
    if (!isBillingWindowOpen(invoice.dueDate, today)) {
      result.emailSkipped += 1;
      continue;
    }

    try {
      const sent = await sendInvoiceEmail(ctx, { invoiceId: invoice.id });
      if (sent.status === "sent") result.emailed += 1;
      else result.emailSkipped += 1;
    } catch (error) {
      // Falha de um responsável não pode interromper os outros nem desfazer a cobrança.
      console.error("[billing] falha ao enviar cobrança", invoice.id, error);
      result.emailFailed += 1;
    }
  }

  return result;
}
