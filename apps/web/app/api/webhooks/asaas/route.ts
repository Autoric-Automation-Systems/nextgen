import { NextResponse } from "next/server";
import { createAdminClient } from "@nextgen/db";
import { nextPeriodEnd } from "@nextgen/core";
import {
  mapAsaasStatus,
  parseAsaasDate,
  reaisToCents,
  verifyWebhookToken,
  type AsaasPayment,
} from "@nextgen/integrations";

/**
 * Webhook do Asaas: faturas da assinatura da NextGen (doc 18).
 *
 * Só mexe em `saas_charges` / `saas_subscriptions`. Nenhum caminho daqui toca em
 * `invoices`: mensalidade de aluno não passa por gateway, então um pagamento no Asaas
 * nunca pode "baixar" a cobrança de um responsável.
 *
 * Roda com o cliente administrativo porque webhook não tem sessão nem tenant; a escola
 * é descoberta pelo identificador da assinatura ou do cliente no próprio payload.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookBody = {
  event?: string;
  payment?: AsaasPayment & { customer?: string; subscription?: string | null };
};

const PAYMENT_EVENTS = new Set([
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
]);

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!verifyWebhookToken(token, process.env.ASAAS_WEBHOOK_TOKEN ?? null)) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const payment = body.payment;
  if (!body.event || !payment?.id) {
    // 200 de propósito: evento que não interessa não deve entrar na fila de retentativas.
    return NextResponse.json({ ignored: true });
  }
  if (!PAYMENT_EVENTS.has(body.event)) {
    return NextResponse.json({ ignored: true });
  }

  const admin = createAdminClient();
  try {
    const subscription = await admin.saasSubscription.findFirst({
      where: payment.subscription
        ? { asaasSubscriptionId: payment.subscription }
        : { asaasCustomerId: payment.customer ?? "" },
      select: { id: true, schoolId: true },
    });

    if (!subscription) {
      return NextResponse.json({ ignored: true, reason: "assinatura não encontrada" });
    }

    const status = mapAsaasStatus(payment.status);
    const dueDate = parseAsaasDate(payment.dueDate);

    await admin.saasCharge.upsert({
      where: { asaasPaymentId: payment.id },
      create: {
        schoolId: subscription.schoolId,
        asaasPaymentId: payment.id,
        status,
        amountCents: reaisToCents(payment.value),
        dueDate,
        paidAt: payment.paymentDate ? parseAsaasDate(payment.paymentDate) : null,
        billingType: payment.billingType ?? null,
        invoiceUrl: payment.invoiceUrl ?? null,
      },
      update: {
        status,
        amountCents: reaisToCents(payment.value),
        dueDate,
        paidAt: payment.paymentDate ? parseAsaasDate(payment.paymentDate) : null,
        billingType: payment.billingType ?? null,
        invoiceUrl: payment.invoiceUrl ?? null,
      },
    });

    if (status === "paid") {
      await admin.saasSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "active",
          nextDueDate: nextPeriodEnd(dueDate),
          currentPeriodEnd: nextPeriodEnd(dueDate),
        },
      });
    } else if (status === "overdue") {
      await admin.saasSubscription.update({
        where: { id: subscription.id },
        data: { status: "past_due" },
      });
    } else if (status === "canceled") {
      await admin.saasSubscription.update({
        where: { id: subscription.id },
        data: { status: "canceled", canceledAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    // 500 faz o Asaas reenviar; a gravação é idempotente por `asaas_payment_id`.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "falha ao processar" },
      { status: 500 },
    );
  } finally {
    await admin.$disconnect();
  }
}
