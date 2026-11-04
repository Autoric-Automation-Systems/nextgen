import { NextResponse } from "next/server";
import { assertRlsIsEnforced, prisma } from "@nextgen/db";
import { mailTransport, probeSmtp, smtpConfig } from "@nextgen/auth/mail";
import {
  appConfigPresence,
  dbConfigPresence,
  describeDbDetail,
  describeDbFailure,
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

    return NextResponse.json(
      {
        config,
        status: rls ? "ok" : "degraded",
        db: "up",
        rls,
        mail: mailTransport(),
        smtp: await smtpState(),
        migrations: await migrationState(),
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      },
      { status: rls ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "down",
        reason: describeDbFailure(error),
        detail: describeDbDetail(error),
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
 */
async function migrationState(): Promise<"aplicadas" | "ausentes"> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      select count(*)::int as n from _prisma_migrations
      where finished_at is not null and rolled_back_at is null
    `;
    return Number(rows[0]?.n ?? 0) > 0 ? "aplicadas" : "ausentes";
  } catch {
    return "ausentes";
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
