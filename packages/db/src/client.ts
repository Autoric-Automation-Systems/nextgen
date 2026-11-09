import { PrismaClient } from "@prisma/client";
import { appDatabaseUrl, directDatabaseUrl, normalizeUrl, resolveDatabaseConfig } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cliente de runtime: conecta com o papel de aplicação (`nextgen_app`), que não é
 * superusuário e não tem BYPASSRLS. É isso que faz a RLS valer de verdade — com o
 * papel dono das tabelas, política nenhuma seria aplicada.
 */
export function createAppClient(url = appDatabaseUrl()) {
  if (!url) {
    throw new Error(
      "APP_DATABASE_URL (ou APP_DB_PASSWORD + DATABASE_URL) não configurada neste ambiente",
    );
  }
  return new PrismaClient({ datasources: { db: { url: normalizeUrl(url) } } });
}

export { resolveDatabaseConfig };

/**
 * Cliente construído no primeiro uso, não no import.
 *
 * Criar no import derrubava o módulo inteiro quando a variável faltava — inclusive
 * rotas que só importam `createAdminClient` (cron, webhook, bootstrap) e o `/api/health`,
 * cujo trabalho é justamente dizer que a configuração está faltando. O erro passa a
 * acontecer onde pode ser explicado: no primeiro acesso ao banco.
 */
export function lazyClient<T extends object>(factory: () => T): T {
  let client: T | undefined;
  const instance = () => (client ??= factory());

  return new Proxy({} as T, {
    get(_target, prop) {
      // Sem isso, `await prisma` trataria o proxy como thenable e travaria.
      if (prop === "then") return undefined;

      const target = instance();
      const value = Reflect.get(target, prop, target);
      // `$transaction` e `$queryRaw` usam `this`: devolver o método solto quebra a chamada.
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const prisma = globalForPrisma.prisma ?? lazyClient(createAppClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Cliente administrativo (dono das tabelas): migrações, seed e backoffice. */
export function createAdminClient(url = directDatabaseUrl() ?? process.env.DATABASE_URL) {
  if (!url) {
    throw new Error(
      "DATABASE_URL (ou DATABASE_URL_UNPOOLED/DIRECT_URL) não configurada neste ambiente",
    );
  }
  // `DATABASE_URL` chega crua aqui: sem normalizar, espaço colado na Vercel derruba o
  // Prisma com erro que culpa o protocolo.
  return new PrismaClient({ datasources: { db: { url: normalizeUrl(url) } } });
}

export type { Prisma, PrismaClient } from "@prisma/client";
export * from "@prisma/client";
