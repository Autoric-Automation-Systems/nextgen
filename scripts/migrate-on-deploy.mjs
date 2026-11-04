/**
 * Aplica as migrações durante o build da Vercel.
 *
 * Existe porque as credenciais do banco estão nas variáveis do projeto na Vercel
 * (integração Neon: `DATABASE_URL_UNPOOLED`, `PGHOST`, ...) e o GitHub Actions não
 * enxerga essas variáveis — são plataformas diferentes. Migrar no build usa o que já
 * está configurado, sem duplicar segredo em dois lugares.
 *
 * Falha de conexão aqui não derruba o deploy: o site continua no ar com o build
 * anterior e o `/api/health` reporta `migrations` — derrubar o site por causa de um
 * host suspenso trocaria um problema de banco por um problema de disponibilidade.
 *
 * Só roda em produção. Preview e build local compartilham a mesma `DATABASE_URL`, então
 * migrar ali aplicaria alteração de schema sem ninguém pedir. `MIGRATE_ON_BUILD=1` força.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { candidates, pickPassword } from "./lib/migration-candidates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = path.join(root, "packages/db/prisma/schema.prisma");
const prisma = path.join(root, "packages/db/node_modules/.bin/prisma");

function probe(url) {
  try {
    execFileSync(prisma, ["db", "execute", "--schema", schema, "--stdin"], {
      env: { ...process.env, DATABASE_URL: url },
      input: "select 1;",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 20_000,
    });
    return true;
  } catch {
    return false;
  }
}

if (process.env.VERCEL_ENV !== "production" && process.env.MIGRATE_ON_BUILD !== "1") {
  console.log(`[migrate] ambiente ${process.env.VERCEL_ENV ?? "local"}; pulando`);
  process.exit(0);
}

const list = candidates(process.env);

if (list.length === 0) {
  console.log("[migrate] sem URL direta no ambiente; nada a aplicar");
  process.exit(0);
}

const reachable = list.find((candidate) => {
  const ok = probe(candidate.value);
  console.log(`[migrate] ${candidate.name}: ${ok ? "alcançável" : "sem resposta"}`);
  return ok;
});

if (!reachable) {
  console.log("[migrate] nenhuma conexão direta respondeu; build segue sem migrar");
  process.exit(0);
}

console.log(`[migrate] aplicando migrações com ${reachable.name}`);

execFileSync(prisma, ["migrate", "deploy", "--schema", schema], {
  env: { ...process.env, DATABASE_URL: reachable.value },
  stdio: "inherit",
});

const password = pickPassword(process.env);

if (!password) {
  console.log("[migrate] sem senha de aplicação; papel nextgen_app fica sem login");
  process.exit(0);
}

/**
 * O papel nasce NOLOGIN na migração de RLS: aplicar a senha é o passo que liga o
 * login do runtime. `$pw$` evita quebrar com aspas na senha — dólar-quoting no
 * Postgres não interpreta o conteúdo.
 */
const sql = `alter role nextgen_app login password $pw$${password.value}$pw$;`;

execFileSync(prisma, ["db", "execute", "--schema", schema, "--stdin"], {
  env: { ...process.env, DATABASE_URL: reachable.value },
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
});

console.log(`[migrate] login do papel de aplicação liberado (senha de ${password.name})`);
