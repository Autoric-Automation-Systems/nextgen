import { NextResponse } from "next/server";
import { assertRlsIsEnforced, prisma } from "@nextgen/db";
import { mailTransport } from "@nextgen/auth/mail";

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

  try {
    await prisma.$queryRaw`select 1`;
    const rls = await assertRlsIsEnforced();

    return NextResponse.json(
      {
        status: rls ? "ok" : "degraded",
        db: "up",
        rls,
        mail: mailTransport(),
        latencyMs: Date.now() - startedAt,
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      },
      { status: rls ? 200 : 503, headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "down", latencyMs: Date.now() - startedAt },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
