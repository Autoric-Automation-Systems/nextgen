"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@nextgen/db";
import { TRIAL_DAYS, firstDueDate, planPriceCents, saasPlan, type SaasPlanCode } from "@nextgen/core";
import {
  AsaasClient,
  AsaasError,
  mapAsaasStatus,
  parseAsaasDate,
  reaisToCents,
} from "@nextgen/integrations";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { saasConfig } from "@/lib/saas";
import { isoDate } from "@/lib/format";

export type SaasState = { status: "idle" | "ok" | "error"; message?: string };

const ok = (message: string): SaasState => ({ status: "ok", message });
const fail = (message: string): SaasState => ({ status: "error", message });

async function billingAdmin() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || workspace.readOnly) return null;
  if (workspace.role !== "admin" || !workspace.can("school:write")) return null;
  return { session, workspace };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** CPF/CNPJ só deixa de ser sensível se não for guardado: vai ao Asaas e morre aqui. */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Contrata ou troca o plano da escola.
 *
 * O CNPJ é digitado de novo a cada contratação porque o banco guarda apenas hash e os
 * quatro últimos dígitos (doc 02). O Asaas exige o documento completo para emitir a
 * cobrança, então ele passa por aqui sem ser persistido.
 */
export async function subscribeSchool(_prev: SaasState, formData: FormData): Promise<SaasState> {
  const context = await billingAdmin();
  if (!context) return fail("Só a administração da escola contrata o plano.");

  const config = saasConfig();
  if (!config) return fail("Pagamento não configurado no servidor (ASAAS_API_KEY ausente).");

  const planCode = text(formData, "planCode") as SaasPlanCode;
  const plan = saasPlan(planCode);
  if (!plan) return fail("Escolha um plano.");

  const document = digits(text(formData, "cpfCnpj"));
  if (document.length !== 11 && document.length !== 14) {
    return fail("Informe CPF ou CNPJ válido do responsável pela escola.");
  }

  const schoolId = context.workspace.schoolId;
  const userId = context.session.userId;

  const snapshot = await withTenant({ schoolId, userId }, async (tx) => {
    const school = await tx.school.findFirst({
      where: { id: schoolId },
      select: {
        tradeName: true,
        planCode: true,
        trialEndsAt: true,
        createdAt: true,
        saasSubscription: { select: { asaasCustomerId: true, asaasSubscriptionId: true } },
        _count: { select: { students: { where: { status: "active", deletedAt: null } } } },
      },
    });
    if (!school) return null;
    return { school, seats: school._count.students };
  });

  if (!snapshot) return fail("Escola não encontrada para esta sessão.");

  const priceCents = planPriceCents(plan.code, snapshot.seats);
  // Escola sem data de teste gravada conta o teste a partir da criação do cadastro.
  const trialEndsAt =
    snapshot.school.trialEndsAt ??
    new Date(snapshot.school.createdAt.getTime() + TRIAL_DAYS * 86_400_000);
  const dueDate = firstDueDate(trialEndsAt, new Date());

  const client = new AsaasClient(config);

  try {
    let customerId = snapshot.school.saasSubscription?.asaasCustomerId ?? null;
    if (!customerId) {
      const customer = await client.createCustomer({
        name: snapshot.school.tradeName,
        email: context.session.email,
        cpfCnpj: document,
        externalReference: schoolId,
      });
      customerId = customer.id;
    }

    // Primeiro vencimento cai no fim do teste; depois disso a cobrança é imediata.
    const subscription = await client.createSubscription({
      customerId,
      valueCents: priceCents,
      nextDueDate: isoDate(dueDate),
      description: `NextGen — plano ${plan.name}`,
      externalReference: schoolId,
    });

    await withTenant({ schoolId, userId }, (tx) =>
      tx.saasSubscription.upsert({
        where: { schoolId },
        create: {
          schoolId,
          planCode: plan.code,
          status: dueDate.getTime() > Date.now() ? "trialing" : "active",
          priceCents,
          seats: snapshot.seats,
          trialEndsAt,
          nextDueDate: dueDate,
          asaasCustomerId: customerId,
          asaasSubscriptionId: subscription.id,
        },
        update: {
          planCode: plan.code,
          priceCents,
          seats: snapshot.seats,
          trialEndsAt,
          nextDueDate: dueDate,
          status: dueDate.getTime() > Date.now() ? "trialing" : "active",
          asaasCustomerId: customerId,
          asaasSubscriptionId: subscription.id,
          canceledAt: null,
        },
      }),
    );
  } catch (error) {
    return fail(
      error instanceof AsaasError
        ? `O Asaas recusou a contratação (${error.status}). Revise o documento e tente de novo.`
        : "Não foi possível falar com o Asaas agora. Tente novamente em instantes.",
    );
  }

  revalidatePath("/assinatura");
  return ok(
    `Plano ${plan.name} contratado. A primeira fatura vence em ${isoDate(dueDate)
      .split("-")
      .reverse()
      .join("/")}.`,
  );
}

/** Traz do Asaas as faturas pagas e em aberto, para o histórico não depender do webhook. */
export async function syncSaasCharges(_prev: SaasState, _formData: FormData): Promise<SaasState> {
  const context = await billingAdmin();
  if (!context) return fail("Só a administração da escola sincroniza as faturas.");

  const config = saasConfig();
  if (!config) return fail("Pagamento não configurado no servidor (ASAAS_API_KEY ausente).");

  const schoolId = context.workspace.schoolId;
  const userId = context.session.userId;

  const subscription = await withTenant({ schoolId, userId }, (tx) =>
    tx.saasSubscription.findFirst({ select: { asaasSubscriptionId: true } }),
  );
  if (!subscription?.asaasSubscriptionId) {
    return fail("Esta escola ainda não tem assinatura no Asaas.");
  }

  const client = new AsaasClient(config);

  let synced = 0;
  try {
    const { data } = await client.listSubscriptionPayments(subscription.asaasSubscriptionId);

    for (const payment of data) {
      await withTenant({ schoolId, userId }, (tx) =>
        tx.saasCharge.upsert({
          where: { asaasPaymentId: payment.id },
          create: {
            schoolId,
            asaasPaymentId: payment.id,
            status: mapAsaasStatus(payment.status),
            amountCents: reaisToCents(payment.value),
            dueDate: parseAsaasDate(payment.dueDate),
            paidAt: payment.paymentDate ? parseAsaasDate(payment.paymentDate) : null,
            billingType: payment.billingType ?? null,
            invoiceUrl: payment.invoiceUrl ?? null,
          },
          update: {
            status: mapAsaasStatus(payment.status),
            amountCents: reaisToCents(payment.value),
            dueDate: parseAsaasDate(payment.dueDate),
            paidAt: payment.paymentDate ? parseAsaasDate(payment.paymentDate) : null,
            invoiceUrl: payment.invoiceUrl ?? null,
          },
        }),
      );
      synced += 1;
    }
  } catch {
    return fail("Não consegui consultar as faturas no Asaas agora. Tente novamente.");
  }

  revalidatePath("/assinatura");
  return ok(`${synced} fatura(s) sincronizada(s).`);
}

/** Cancela no gateway e no espelho local. Acesso continua até o fim do período pago. */
export async function cancelSaasSubscription(
  _prev: SaasState,
  _formData: FormData,
): Promise<SaasState> {
  const context = await billingAdmin();
  if (!context) return fail("Só a administração da escola cancela o plano.");

  const config = saasConfig();
  if (!config) return fail("Pagamento não configurado no servidor (ASAAS_API_KEY ausente).");

  const schoolId = context.workspace.schoolId;
  const userId = context.session.userId;

  const subscription = await withTenant({ schoolId, userId }, (tx) =>
    tx.saasSubscription.findFirst({ select: { asaasSubscriptionId: true } }),
  );
  if (!subscription?.asaasSubscriptionId) return fail("Não há assinatura para cancelar.");

  try {
    await new AsaasClient(config).cancelSubscription(subscription.asaasSubscriptionId);
  } catch {
    return fail("O Asaas não confirmou o cancelamento. Tente novamente.");
  }

  await withTenant({ schoolId, userId }, (tx) =>
    tx.saasSubscription.update({
      where: { schoolId },
      data: { status: "canceled", canceledAt: new Date() },
    }),
  );

  revalidatePath("/assinatura");
  return ok("Assinatura cancelada. As faturas já emitidas continuam valendo.");
}
