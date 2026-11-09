import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O cliente padrão é criado na primeira query, não no import.
 *
 * Antes, importar `@nextgen/db` sem `APP_DATABASE_URL` derrubava a função inteira —
 * inclusive `/api/health`, que existe justamente para dizer que a variável falta.
 */

const CONFIG_VARS = [
  "APP_DATABASE_URL",
  "APP_DB_PASSWORD",
  "NEXTGEN_APP_PASSWORD",
  "PGPASSWORD_APP",
  "PGHOST",
  "PGHOST_UNPOOLED",
  "PGDATABASE",
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
];

function clearConfig() {
  for (const name of CONFIG_VARS) vi.stubEnv(name, "");
}

async function freshClient() {
  vi.resetModules();
  delete (globalThis as { prisma?: unknown }).prisma;
  return import("../src/client");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (globalThis as { prisma?: unknown }).prisma;
});

describe("cliente padrão do banco", () => {
  it("importa sem configuração e só reclama no primeiro uso, apontando a variável", async () => {
    clearConfig();

    const { prisma } = await freshClient();

    expect(() => prisma.student).toThrow(/APP_DATABASE_URL/);
    expect(() => prisma.student).toThrow(/não configurada/);
  });

  it("não deixa `await prisma` virar promessa pendurada", async () => {
    clearConfig();
    const { prisma } = await freshClient();

    expect((prisma as { then?: unknown }).then).toBeUndefined();
  });

  it("com a URL presente, o delegate existe e nada conecta na importação", async () => {
    clearConfig();
    vi.stubEnv("APP_DATABASE_URL", "postgresql://nextgen_app:senha@127.0.0.1:5432/nextgen");

    const { prisma } = await freshClient();

    expect(prisma.student).toBeTypeOf("object");
    expect(prisma.$transaction).toBeTypeOf("function");
  });

  it("$transaction continua ligado ao cliente real", async () => {
    clearConfig();
    vi.stubEnv("APP_DATABASE_URL", "postgresql://nextgen_app:senha@127.0.0.1:5432/nextgen");

    const { prisma } = await freshClient();
    // Métodos do Prisma usam `this`; sem o bind, a chamada morre com "cannot read of undefined".
    const bound = prisma.$transaction as { name?: string };
    expect(typeof bound).toBe("function");
  });
});
