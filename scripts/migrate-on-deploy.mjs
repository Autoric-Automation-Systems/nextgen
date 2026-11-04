/**
 * Migra e ajusta privilégios durante o build da Vercel.
 *
 * Por que aqui e não no GitHub Actions: as credenciais do banco vivem nas variáveis do
 * projeto na Vercel (integração Neon: `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGPASSWORD`).
 * O Actions não enxerga essas variáveis — cofres separados. Migrar no build usa o que já
 * está configurado, sem duplicar segredo em dois lugares.
 *
 * Nada aqui derruba o deploy. Site fora do ar é pior que site no ar com schema pendente,
 * e o `/api/health` reporta o que faltou. `MIGRATE_STRICT=1` inverte isso, para quem
 * quiser build que falha.
 *
 * Só roda em produção: preview compartilha a mesma `DATABASE_URL`, e migrar ali aplicaria
 * schema sem ninguém pedir.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { candidates, pickPassword } from "./lib/migration-candidates.mjs";
import { isRolePrivilegeFailure, parseFailedMigration } from "./lib/migration-failure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = path.join(root, "packages/db/prisma/schema.prisma");
const grants = path.join(root, "packages/db/prisma/sql/app-role-grants.sql");
const prisma = path.join(root, "packages/db/node_modules/.bin/prisma");

const strict = process.env.MIGRATE_STRICT === "1";

function run(args, url, input) {
  try {
    const output = execFileSync(prisma, args, {
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { ok: true, output };
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    return { ok: false, output: `${stdout}${stderr}` || String(error.message) };
  }
}

function bail(message, detail) {
  console.error(`[migrate] ${message}`);
  if (detail) console.error(detail.trim().split("\n").slice(0, 12).join("\n"));
  process.exit(strict ? 1 : 0);
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
  const ok = run(["db", "execute", "--schema", schema, "--stdin"], candidate.value, "select 1;").ok;
  console.log(`[migrate] ${candidate.name}: ${ok ? "alcançável" : "sem resposta"}`);
  return ok;
});

if (!reachable) {
  console.log("[migrate] nenhuma conexão direta respondeu; build segue sem migrar");
  process.exit(0);
}

const url = reachable.value;
console.log(`[migrate] aplicando migrações com ${reachable.name}`);

let migration = run(["migrate", "deploy", "--schema", schema], url);

/**
 * Um deploy anterior que falhou deixa a migração registrada como falha e o Prisma passa
 * a recusar qualquer migração nova (P3009). A migração roda em transação, então o banco
 * está limpo: marcar como revertida libera a nova tentativa.
 */
if (!migration.ok) {
  const failed = parseFailedMigration(migration.output);

  if (failed) {
    console.log(`[migrate] migração ${failed} falhou antes; marcando como revertida`);
    run(["migrate", "resolve", "--rolled-back", failed, "--schema", schema], url);
    migration = run(["migrate", "deploy", "--schema", schema], url);
  }
}

if (!migration.ok) {
  const hint = isRolePrivilegeFailure(migration.output)
    ? "o dono do banco não pode criar papel: crie nextgen_app em Neon > Roles (com senha) e defina APP_DATABASE_URL"
    : "veja o erro nas mensagens acima";
  bail(`migrações não aplicadas — ${hint}`, migration.output);
}

console.log(migration.output.trim().split("\n").slice(-2).join("\n"));

const grantsResult = run(["db", "execute", "--file", grants, "--schema", schema], url);

if (!grantsResult.ok) {
  bail("privilégios do papel de aplicação não aplicados", grantsResult.output);
}

console.log("[migrate] privilégios do papel de aplicação conferidos");

const password = pickPassword(process.env);

if (!password) {
  console.log("[migrate] sem senha de aplicação no ambiente; o papel já deve ter a sua");
  process.exit(0);
}

/**
 * `ALTER ROLE` de outro papel exige CREATEROLE, que o dono no Neon não tem. Falhar aqui
 * não é erro: o papel criado pelo console já tem senha.
 */
const sql = `alter role nextgen_app login password $pw$${password.value}$pw$;`;
const passwordResult = run(["db", "execute", "--schema", schema, "--stdin"], url, sql);

if (passwordResult.ok) {
  console.log(`[migrate] senha do papel atualizada (${password.name})`);
} else {
  console.log("[migrate] senha do nextgen_app não pôde ser alterada por SQL; use a do console");
}
