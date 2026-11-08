import { withTenant } from "@nextgen/db";
import { competenceLabel, formatBRL, pixPayload, type Competence } from "@nextgen/core";
import { defaultMailer, loggingMailer } from "@nextgen/auth";
import type { TenantContext } from "./billing";

/**
 * Envio da cobrança ao responsável financeiro.
 *
 * Um só caminho para os dois botões: o manual, cobrança por cobrança, e o job do dia
 * combinado. Se fossem dois códigos, o texto do e-mail e a regra de "quem recebe" iam
 * divergir no primeiro ajuste.
 */

export type SendFailure =
  | "not_found"
  | "canceled"
  | "no_guardian"
  | "mail_failed"
  | "already_sent";

export type SendResult = { ok: true; to: string } | { ok: false; reason: SendFailure };

export type SendOptions = {
  /** Manual: reenvia mesmo que já tenha saído neste mês. */
  force?: boolean;
  today?: Date;
};

export const SEND_FAILURE_MESSAGE: Record<SendFailure, string> = {
  not_found: "Cobrança não encontrada nesta escola.",
  canceled: "Cobrança cancelada não é enviada.",
  no_guardian:
    "Não encontrei responsável financeiro com e-mail nesta cobrança. Cadastre o responsável antes de enviar.",
  mail_failed: "O provedor de e-mail recusou o envio. A cobrança continua em aberto para reenvio.",
  already_sent: "Esta cobrança já foi enviada neste mês. Use o botão de reenvio se precisar.",
};

export async function sendInvoiceEmail(
  ctx: TenantContext,
  invoiceId: string,
  options: SendOptions = {},
): Promise<SendResult> {
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
    if (!invoice) return { kind: "error" as const, failure: "not_found" as const };
    if (invoice.status === "canceled") return { kind: "error" as const, failure: "canceled" as const };

    const guardian = invoice.student.guardians[0]?.guardian.user;
    if (!guardian?.email) return { kind: "error" as const, failure: "no_guardian" as const };

    if (!options.force && invoice.lastSentAt) {
      const sameMonth =
        invoice.lastSentAt.getUTCFullYear() === Number(invoice.competence.slice(0, 4)) &&
        invoice.lastSentAt.getUTCMonth() + 1 === Number(invoice.competence.slice(5, 7));
      if (sameMonth) return { kind: "error" as const, failure: "already_sent" as const };
    }

    const paid = invoice.payments.reduce((total, payment) => total + payment.amount, 0);
    return {
      kind: "ok" as const,
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
    };
  });

  if (data.kind === "error") return { ok: false, reason: data.failure };

  const label = competenceLabel(data.competence);
  const due = data.dueDate.toISOString().slice(0, 10).split("-").reverse().join("/");

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
    lines.push("", "A escola ainda não configurou a chave Pix; peça o boleto na secretaria.");
  }

  lines.push("", `Qualquer dúvida, fale com a secretaria de ${data.schoolName}.`);

  try {
    await loggingMailer(defaultMailer(), "charge").send({
      to: data.to,
      subject: `${data.schoolName} — mensalidade de ${label}`,
      text: lines.join("\n"),
    });
  } catch {
    return { ok: false, reason: "mail_failed" };
  }

  await withTenant(ctx, (tx) =>
    tx.invoice.update({
      where: { id: invoiceId },
      data: { lastSentAt: options.today ?? new Date(), sendCount: { increment: 1 } },
    }),
  );

  return { ok: true, to: data.to };
}
