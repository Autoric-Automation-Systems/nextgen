import { NextResponse } from "next/server";
import { competenceOf, todayUtc } from "@nextgen/core";
import { withSystemJob } from "@nextgen/db";
import { runMonthlyBilling } from "@/lib/billing-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cobrança automática das mensalidades.
 *
 * Chamado por um agendador externo de hora em hora. Cada execução pergunta "algum aluno
 * entrou na janela do vencimento?" e gera só para ele: quem vence dia 5 recebe no dia 1,
 * quem vence dia 30 recebe no dia 25, em vez de a escola inteira no mesmo dia.
 *
 * Idempotente por dois mecanismos independentes — índice único (aluno, competência) e
 * `notified_at` —, então rodar de novo no mesmo dia não cobra nem avisa duas vezes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const today = todayUtc();
  const competence = competenceOf(today);

  // O cron não tem sessão. Ele lista as escolas como papel de serviço e entra em cada uma
  // com `withTenant`; a RLS continua valendo dentro de cada escola.
  const schools = await withSystemJob((tx) =>
    tx.school.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, slug: true },
      orderBy: { createdAt: "asc" },
    }),
  );

  const summary = {
    competence,
    schools: schools.length,
    created: 0,
    alreadyThere: 0,
    emailed: 0,
    emailSkipped: 0,
    emailFailed: 0,
    failures: [] as { school: string; error: string }[],
  };

  for (const school of schools) {
    try {
      const result = await runMonthlyBilling(
        { schoolId: school.id, userId: null },
        { competence, today, onlyDueSoon: true, notify: true },
      );
      summary.created += result.created;
      summary.alreadyThere += result.alreadyThere;
      summary.emailed += result.emailed;
      summary.emailSkipped += result.emailSkipped;
      summary.emailFailed += result.emailFailed;
    } catch (error) {
      // Uma escola com dado quebrado não pode impedir a cobrança das outras.
      console.error("[cron] mensalidades falharam", school.slug, error);
      summary.failures.push({ school: school.slug, error: String(error) });
    }
  }

  return NextResponse.json(summary, { status: summary.failures.length > 0 ? 207 : 200 });
}
