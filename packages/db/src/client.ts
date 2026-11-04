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
    throw new Error("URL do banco de aplicação não configurada");
  }
  return new PrismaClient({ datasources: { db: { url: normalizeUrl(url) } } });
}

export { resolveDatabaseConfig };

export const prisma = globalForPrisma.prisma ?? createAppClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Cliente administrativo (dono das tabelas): migrações, seed e backoffice. */
export function createAdminClient(url = directDatabaseUrl() ?? process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("URL do banco administrativo não configurada");
  }
  // `DATABASE_URL` chega crua aqui: sem normalizar, espaço colado na Vercel derruba o
  // Prisma com erro que culpa o protocolo.
  return new PrismaClient({ datasources: { db: { url: normalizeUrl(url) } } });
}

export type { Prisma, PrismaClient } from "@prisma/client";
export * from "@prisma/client";
