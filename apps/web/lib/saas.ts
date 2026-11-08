import { withTenant } from "@nextgen/db";
import {
  SAAS_STATUS_LABEL,
  TRIAL_DAYS,
  daysLeftInTrial,
  effectiveStatus,
  planPriceCents,
  saasPlan,
  suggestedPlan,
  type SaasPlan,
  type SaasStatus,
} from "@nextgen/core";
import { asaasConfigFromEnv, type AsaasConfig } from "@nextgen/integrations";
import type { TenantContext } from "./billing";

/**
 * Assinatura da escola com a NextGen (doc 18).
 *
 * O valor é do produto, não da mensalidade: `invoices` é dinheiro da escola, isto é
 * dinheiro da NextGen. Por isso aqui existe Asaas — e lá não.
 */

export type SaasChargeView = {
  id: string;
  status: string;
  amountCents: number;
  dueDate: Date;
  paidAt: Date | null;
  invoiceUrl: string | null;
};

export type SaasView = {
  schoolName: string;
  plan: SaasPlan | null;
  planCode: string;
  status: SaasStatus;
  statusLabel: string;
  priceCents: number;
  seats: number;
  activeStudents: number;
  trialEndsAt: Date | null;
  trialDaysLeft: number | null;
  nextDueDate: Date | null;
  cancelAtPeriodEnd: boolean;
  charges: SaasChargeView[];
  /** Sem chave do Asaas a tela não oferece assinar — não se cria fatura que não existe. */
  gatewayReady: boolean;
  suggested: SaasPlan;
  suggestedPriceCents: number;
};

export function saasConfig(): AsaasConfig | null {
  return asaasConfigFromEnv();
}

export async function getSaasView(ctx: TenantContext): Promise<SaasView> {
  const data = await withTenant(ctx, async (tx) => {
    const school = await tx.school.findFirst({
      where: { id: ctx.schoolId },
      select: {
        tradeName: true,
        planCode: true,
        trialEndsAt: true,
        createdAt: true,
        saasSubscription: {
          select: {
            planCode: true,
            status: true,
            priceCents: true,
            seats: true,
            trialEndsAt: true,
            nextDueDate: true,
            currentPeriodEnd: true,
            canceledAt: true,
          },
        },
        _count: { select: { students: { where: { status: "active", deletedAt: null } } } },
      },
    });
    if (!school) return null;

    const charges = await tx.saasCharge.findMany({
      orderBy: { dueDate: "desc" },
      take: 24,
      select: {
        id: true,
        status: true,
        amountCents: true,
        dueDate: true,
        paidAt: true,
        invoiceUrl: true,
      },
    });

    return { school, charges };
  });

  if (!data) throw new Error("escola não encontrada para a sessão");

  const activeStudents = data.school._count.students;
  const fallbackTrial = new Date(data.school.createdAt.getTime() + TRIAL_DAYS * 86_400_000);
  const trialEndsAt = data.school.saasSubscription?.trialEndsAt ?? data.school.trialEndsAt ?? fallbackTrial;

  const planCode = data.school.saasSubscription?.planCode ?? data.school.planCode;
  const stored = data.school.saasSubscription;
  const status = effectiveStatus(
    (stored?.status as SaasStatus | undefined) ?? "trialing",
    trialEndsAt,
    new Date(),
  );

  const suggested = suggestedPlan(activeStudents);

  return {
    schoolName: data.school.tradeName,
    plan: saasPlan(planCode),
    planCode,
    status,
    statusLabel: SAAS_STATUS_LABEL[status],
    priceCents: stored?.priceCents ?? planPriceCents(planCode, activeStudents),
    seats: stored?.seats ?? activeStudents,
    activeStudents,
    trialEndsAt,
    trialDaysLeft: daysLeftInTrial(trialEndsAt, new Date()),
    nextDueDate: stored?.nextDueDate ?? null,
    cancelAtPeriodEnd: Boolean(stored?.canceledAt && stored.currentPeriodEnd && stored.currentPeriodEnd > new Date()),
    charges: data.charges,
    gatewayReady: asaasConfigFromEnv() !== null,
    suggested,
    suggestedPriceCents: planPriceCents(suggested.code, activeStudents),
  };
}
