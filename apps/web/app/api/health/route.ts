import { NextResponse } from "next/server";
import { assertRlsIsEnforced, prisma } from "@nextgen/db";
import { mailTransport, probeSmtp, smtpConfig, verifySmtp } from "@nextgen/auth/mail";
import { defaultBaseURL } from "@nextgen/auth/base-url";
import {
  appConfigPresence,
  dbConfigPresence,
  describeDbDetail,
  connectionHint,
  credentialShape,
  describeDbFailure,
  probeConnections,
  lastDeploy,
  mailRecent,
  missingAppConfig,
  roleState,
  schemaState,
  usageWarnings,
  userCount,
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
/**
 * `?smtp=1` acrescenta a autenticação no provedor. Fica fora do caminho normal porque
 * abre conexão TLS e faz `AUTH`: caro para uma sonda que é chamada a cada deploy, e
 * desnecessário quando ninguém está investigando e-mail.
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const deep = new URL(request.url).searchParams.get("smtp") === "1";
  // O endereço resolvido vai junto: sem ele, `INVALID_ORIGIN` no login não tem como ser
  // explicado — a origem recusada é justamente esta, e ela não é o domínio público.
  const config = { db: dbConfigPresence(), app: { ...appConfigPresence(), authBase: defaultBaseURL() } };

  try {
    await prisma.$queryRaw`select 1`;
    const rls = await assertRlsIsEnforced();
    const migration = await migrationState();

    // `db: up` só com as tabelas no lugar: banco acessível e schema vazio derrubava
    // qualquer tela com 500 enquanto este endpoint dizia estar tudo bem.
    // `db: up` só com as tabelas no lugar: banco acessível e schema vazio derrubava
    // qualquer tela com 500 enquanto este endpoint dizia estar tudo bem.
    //
    // Config ausente entra na conta pelo mesmo motivo: sem `BETTER_AUTH_SECRET` o Better
    // Auth lança em toda página autenticada, e "ok" mandaria procurar o problema no banco.
    const missing = missingAppConfig();
    const healthy = rls && migration.state === "aplicadas" && missing.length === 0;

    return NextResponse.json(
      {
        config,
        status: healthy ? "ok" : "degraded",
        db: "up",
        rls,
        mail: mailTransport(),
        smtp: await smtpState(deep),
        migrations: migration.state,
        migrationFailed: migration.failed,
        missing,
        warnings: usageWarnings(),
        users: await userCount(),
        mailRecent: await mailRecent(),
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      },
      { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const connections = await probeConnections();
    const role = await roleState();

    return NextResponse.json(
      {
        status: "error",
        hint: connectionHint(connections, role),
        credentials: credentialShape(),
        db: "down",
        reason: describeDbFailure(error),
        detail: describeDbDetail(error),
        endpoints: await probeDatabaseEndpoints(),
        connections,
        role,
        schema: await schemaState(),
        lastDeploy: await lastDeploy(),
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
async function smtpState(deep = false) {
  const config = smtpConfig();
  if (!config) return undefined;

  const { reachable, banner, error } = await probeSmtp(config);
  const auth = deep ? await verifySmtp() : undefined;

  return { host: config.host, port: config.port, reachable, banner, error, auth };
}
