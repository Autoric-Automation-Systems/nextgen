import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type TenantContext = {
  schoolId: string;
  /** Usuário da sessão; ausente em jobs de sistema. */
  userId?: string | null;
};

export type Tx = Prisma.TransactionClient;

/**
 * Executa um bloco com o contexto de tenant aplicado via `set_config(..., true)`,
 * que é local à transação. O `school_id` vem da sessão resolvida no servidor,
 * nunca do payload da requisição.
 *
 * Sem contexto, `app.current_school_id()` é null e toda política devolve falso —
 * ou seja, falha fechada.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!ctx.schoolId) {
    throw new Error("withTenant exige schoolId");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.school_id', ${ctx.schoolId}, true)`;
    await tx.$executeRaw`select set_config('app.user_id', ${ctx.userId ?? ""}, true)`;
    return fn(tx);
  });
}

/**
 * Bloco com usuário, sem escola.
 *
 * `withoutTenant` zera os dois sinais — e com isso a política de diretório não reconhece
 * nem a administração da plataforma. Aqui o `user_id` vale e o `school_id` continua vazio:
 * o usuário enxerga o diretório de escolas, não os dados de nenhuma delas.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!userId) throw new Error("withUser exige userId");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.school_id', '', true)`;
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

/**
 * Bloco de job de sistema: sem sessão, sem escola, mas com o sinal `app.system_job`.
 *
 * A única coisa que esse sinal libera é a leitura do diretório de escolas (política
 * `system_school_directory`), o que a cobrança mensal precisa para saber para quem cobrar.
 * Cada escola é então visitada com `withTenant` — o sinal não atravessa a transação.
 */
export async function withSystemJob<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.system_job', 'on', true)`;
    await tx.$executeRaw`select set_config('app.school_id', '', true)`;
    await tx.$executeRaw`select set_config('app.user_id', '', true)`;
    return fn(tx);
  });
}

/** Bloco sem tenant: usado por rotas de plataforma e jobs globais. */
export async function withoutTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.school_id', '', true)`;
    await tx.$executeRaw`select set_config('app.user_id', '', true)`;
    return fn(tx);
  });
}

/**
 * Resolve a escola pelo slug **apenas** entre os vínculos ativos do próprio usuário.
 * Serve para o seletor de escola; o resultado alimenta `withTenant`, nunca a query em si.
 */
export async function findSchoolIdForUser(userId: string, slug: string): Promise<string | null> {
  return withUser(userId, async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { userId, status: "active", school: { slug } },
      select: { schoolId: true },
    });
    return membership?.schoolId ?? null;
  });
}

/** Verificação rápida usada em health checks: o banco aceita a RLS? */
export async function assertRlsIsEnforced(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ enforced: boolean }[]>`
    select (rolsuper = false and rolbypassrls = false) as enforced
    from pg_roles where rolname = current_user
  `;
  return rows[0]?.enforced ?? false;
}
