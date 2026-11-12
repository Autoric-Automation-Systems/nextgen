import { withTenant } from "@nextgen/db";
import { competenceLabel, formatBRL, pixPayload, type Competence } from "@nextgen/core";
import { defaultMailer, loggingMailer } from "@nextgen/auth";

export type InvoiceEmailResult =
  | { status: "sent"; to: string; studentName: string }
  | { status: "skipped"; reason: "not_found" | "canceled" | "already_notified" | "no_guardian" };

export type InvoiceEmailInput = {
  invoiceId: string;
  /** Reenvio manual: ignora `notified_at`. A cobrança automática nunca reenvia. */
  force?: boolean;
};

/**
 * Envia a cobrança por PIX para o responsável financeiro e marca `notified_at`.
 *
 * A marcação acontece **depois** do provedor aceitar: se o envio falhar, o cron tenta de
 * novo amanhã. Marcar antes transformaria uma falha de e-mail em mês sem cobrança.
 */
export async function sendInvoiceEmail(
  ctx: { schoolId: string; userId?: string | null },
  { invoiceId, force = false }: InvoiceEmailInput,
): Promise<InvoiceEmailResult> {
  const data = await withTenant(ctx, async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        student: {
          select: {
            fullName: true,
            guardians: {
              where: { isFinancial: true },
              select: { guardian: { select: { user: { select: { email: true, name: true } } } } },
            },
          },
        },
        school: { select: { tradeName: true, pixKey: true, pixHolder: true, pixCity: true } },
        payments: { select: { amount: true } },
      },
    });
    if (!invoice) return { status: "skipped", reason: "not_found" } as const;
    if (invoice.status === "canceled") return { status: "skipped", reason: "canceled" } as const;
    if (invoice.notifiedAt && !force) return { status: "skipped", reason: "already_notified" } as const;

    const guardian = invoice.student.guardians[0]?.guardian.user;
    if (!guardian?.email) return { status: "skipped", reason: "no_guardian" } as const;

    const paid = invoice.payments.reduce((total, payment) => total + payment.amount, 0);
    return {
      status: "ready",
      to: guardian.email,
      guardianName: guardian.name,
      studentName: invoice.student.fullName,
      schoolName: invoice.school.tradeName,
      competence: invoice.competence as Competence,
      dueDate: invoice.dueDate,
      amount: Math.max(0, invoice.amount - paid),
      pix: invoice.school.pixKey
        ? pixPayload({
            key: invoice.school.pixKey,
            holder: invoice.school.pixHolder ?? invoice.school.tradeName,
            city: invoice.school.pixCity ?? "Brasil",
            amountCents: invoice.amount,
            txid: invoice.id,
          }).payload
        : null,
    } as const;
  });

  if (data.status === "skipped") return data;

  const label = competenceLabel(data.competence);
  const due = data.dueDate.toISOString().slice(0, 10).split("-").reverse().join("/");
  const subject = `${data.schoolName} — mensalidade de ${label}`;

  const lines = [
    `Olá, ${data.guardianName ?? "responsável"}.`,
    "",
    `A mensalidade de ${data.studentName} referente a ${label} está disponível.`,
    `Vencimento: ${due}`,
    `Valor: ${formatBRL(data.amount)}`,
  ];

  if (data.pix) {
    lines.push("", "Pague por Pix copiando o código abaixo no aplicativo do seu banco:", "", data.pix);
  } else {
    lines.push("", "A escola ainda não configurou a chave Pix; peça o link de pagamento na secretaria.");
  }

  lines.push("", `Qualquer dúvida, fale com a secretaria de ${data.schoolName}.`);

  await loggingMailer(defaultMailer(), "charge").send({
    to: data.to,
    subject,
    text: lines.join("\n"),
  });

  await withTenant(ctx, (tx) =>
    tx.invoice.update({ where: { id: invoiceId }, data: { notifiedAt: new Date() } }),
  );

  return { status: "sent", to: data.to, studentName: data.studentName };
}
