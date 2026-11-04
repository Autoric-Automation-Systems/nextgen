import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cliente de runtime: conecta com o papel de aplicação (`nextgen_app`), que não é
 * superusuário e não tem BYPASSRLS. É isso que faz a RLS valer de verdade — com o
 * papel dono das tabelas, política nenhuma seria aplicada.
 */
export function createAppClient(url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("APP_DATABASE_URL (ou DATABASE_URL) não configurada");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export const prisma = globalForPrisma.prisma ?? createAppClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Cliente administrativo (dono das tabelas): migrações, seed e backoffice. */
export function createAdminClient(url = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("DATABASE_URL não configurada");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export type { Prisma, PrismaClient } from "@prisma/client";
export * from "@prisma/client";
