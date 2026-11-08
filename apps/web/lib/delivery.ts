import { withTenant } from "@nextgen/db";
import {
  DEFAULT_DELIVERY,
  normalizeSendDay,
  shouldDeliverToday,
  todayUtc,
  type Competence,
  type DeliverySettings,
} from "@nextgen/core";
import type { TenantContext } from "./billing";

/**
 * Leitura da configuração de envio e das cobranças que o job do dia deve pegar.
 *
 * A regra de "quando e se envia" mora em `@nextgen/core` (`shouldDeliverToday`), testada
 * sem banco. Aqui só se busca o que a regra precisa e se filtra com ela.
 */

export async function getDeliverySettings(ctx: TenantContext): Promise<DeliverySettings> {
  const school = await withTenant(ctx, (tx) =>
    tx.school.findFirst({
      where: { id: ctx.schoolId },
      select: { invoiceSendAutomatic: true, invoiceSendDay: true },
    }),
  );

  return {
    automatic: school?.invoiceSendAutomatic ?? DEFAULT_DELIVERY.automatic,
    sendDay: normalizeSendDay(school?.invoiceSendDay),
  };
}

export type DeliverableInvoice = { id: string; studentName: string };

/** Cobranças em aberto da competência que o job de hoje deve enviar. */
export async function listDeliverables(
  ctx: TenantContext,
  competence: Competence,
  settings: DeliverySettings,
  today: Date = todayUtc(),
): Promise<DeliverableInvoice[]> {
  if (!settings.automatic) return [];

  const monthStart = new Date(`${competence}-01T00:00:00.000Z`);

  return withTenant(ctx, async (tx) => {
    const rows = await tx.invoice.findMany({
      where: {
        competence,
        status: "open",
        OR: [{ lastSentAt: null }, { lastSentAt: { lt: monthStart } }],
      },
      select: { id: true, lastSentAt: true, student: { select: { fullName: true } } },
      orderBy: { createdAt: "asc" },
    });

    // O dia combinado é conferido na regra pura: o job pode rodar de hora em hora sem
    // precisar acertar o minuto, e a tela usa a mesma função para explicar o calendário.
    return rows
      .filter((row) =>
        shouldDeliverToday({ settings, competence, lastSentAt: row.lastSentAt, today }),
      )
      .map((row) => ({ id: row.id, studentName: row.student.fullName }));
  });
}
