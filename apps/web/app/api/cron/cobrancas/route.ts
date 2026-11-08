import { NextResponse } from "next/server";
import { createAdminClient } from "@nextgen/db";
import { competenceOf, normalizeSendDay, todayUtc } from "@nextgen/core";
import { listDeliverables } from "@/lib/delivery";
import { sendInvoiceEmail } from "@/lib/invoice-mail";

/**
 * Job diário: manda o Pix/boleto da escola para o responsável no dia combinado.
 *
 * Idempotente por competência (`shouldDeliverToday`), então rodar de novo à tarde não
 * manda segundo e-mail. Não confundir com a assinatura da NextGen: aqui o dinheiro é da
 * escola e não há gateway no meio — o código Pix é gerado com a chave dela.
 *
 * A listagem de escolas usa o cliente administrativo porque é job de sistema, sem sessão
 * de usuário; cada envio roda dentro do `withTenant` daquela escola, e é a RLS que impede
 * um envio de atravessar para outra.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const today = todayUtc();
  const competence = competenceOf(today);
  const admin = createAdminClient();

  /** Job de sistema: sem usuário, `app.user_id` fica nulo e a RLS vale só pelo tenant. */
const SYSTEM = "";

const result = {
    competence,
    schools: 0,
    sent: 0,
    failed: 0,
    errors: [] as { schoolId: string; message: string }[],
  };

  try {
    const schools = await admin.school.findMany({
      where: { invoiceSendAutomatic: true, deletedAt: null, status: { not: "cancelled" } },
      select: { id: true, invoiceSendDay: true },
    });
    result.schools = schools.length;

    for (const school of schools) {
      const settings = { automatic: true, sendDay: normalizeSendDay(school.invoiceSendDay) };

      try {
        const pending = await listDeliverables(
          { schoolId: school.id, userId: SYSTEM },
          competence,
          settings,
          today,
        );

        for (const invoice of pending) {
          const sent = await sendInvoiceEmail({ schoolId: school.id, userId: SYSTEM }, invoice.id, {
            today,
          });
          if (sent.ok) result.sent += 1;
          else result.failed += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          schoolId: school.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await admin.$disconnect();
  }

  return NextResponse.json(result);
}
