import { NextResponse } from "next/server";
import { assertRlsIsEnforced, prisma } from "@nextgen/db";
import { mailTransport, probeSmtp, smtpConfig } from "@nextgen/auth/mail";
import {
  appConfigPresence,
  dbConfigPresence,
  describeDbDetail,
  describeDbFailure,
  probeConnections,
  roleState,
  probeDatabaseEndpoints,
} from "@/lib/db-diagnosis";

export const dynamic = "force-dynamic";

/**
 * Sonda de deploy. Responde o mínimo e nenhum dado de negócio.
 *
 * `rls: false` em produção significa que a aplicação conectou com um papel que
 * ignora as políticas (superusuário ou BYPASSRLS) — o isolamento entre escolas
 * deixou de existir, mesmo com o login funcionando.
 */
export async function GET() {
  const startedAt = Date.now();
  const config = { db: dbConfigPresence(), app: appConfigPresence() };

  try {
    await prisma.$queryRaw`select 1`;
    const rls = await assertRlsIsEnforced();
    const migration = await migrationState();

    // `db: up` só com as tabelas no lugar: banco acessível e schema vazio derrubava
    // qualquer tela com 500 enquanto este endpoint dizia estar tudo bem.
    const healthy = rls && migration.state === "aplicadas";

    return NextResponse.json(
      {
        config,
        status: healthy ? "ok" : "degraded",
        db: "up",
        rls,
        mail: mailTransport(),
        smtp: await smtpState(),
        migrations: migration.state,
        migrationFailed: migration.failed,
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      },
      { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        reason: describeDbFailure(error),
        detail: describeDbDetail(error),
        endpoints: await probeDatabaseEndpoints(),
        connections: await probeConnections(),
        role: await roleState(),
        config,
        latencyMs: Date.now() - startedAt,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

/**
 * Diz se as migrações chegaram ao banco. Sem isso, "db: up" esconde o caso em que a
 * conexão funciona mas as tabelas não existem — a tela quebra com 500 e o health
 * aparece saudável.
 *
 * `falhou` é o estado que mais engana: a migração abortou, o Prisma registrou a falha e
 * passa a recusar qualquer migração nova (P3009). O nome vai junto porque sem ele a
 * única saída é adivinhar qual `migrate resolve` rodar.
 */
async function migrationState(): Promise<{
  state: "aplicadas" | "ausentes" | "falhou";
  failed?: string;
}> {
  try {
    const rows = await prisma.$queryRaw<{ applied: number; failed: number; name: string | null }[]>`
      select
        count(*) filter (where finished_at is not null and rolled_back_at is null)::int as applied,
        count(*) filter (where finished_at is null and rolled_back_at is null)::int as failed,
        (select migration_name from _prisma_migrations
          where finished_at is null and rolled_back_at is null
          order by started_at desc limit 1) as name
      from _prisma_migrations
    `;

    const row = rows[0];
    if (!row) return { state: "ausentes" };
    if (Number(row.failed) > 0) return { state: "falhou", failed: row.name ?? undefined };

    return { state: Number(row.applied) > 0 ? "aplicadas" : "ausentes" };
  } catch {
    return { state: "ausentes" };
  }
}

/**
 * Só quando o transporte é SMTP: confirma que a porta abre a partir da Vercel.
 * Sem isso, senha errada e porta bloqueada produzem o mesmo "envio falhou".
 */
async function smtpState() {
  const config = smtpConfig();
  if (!config) return undefined;

  const { reachable, banner, error } = await probeSmtp(config);
  return { host: config.host, port: config.port, reachable, banner, error };
}
