#!/usr/bin/env node
/**
 * Verifica um deploy já no ar. Sem dependências: basta `node scripts/check-deploy.mjs <url>`.
 *
 *   node scripts/check-deploy.mjs https://nextgen.exemplo.com
 *
 * Sai com código 1 se o isolamento por escola não estiver ativo — é o único
 * item que não pode falhar em produção.
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");

if (!base) {
  console.error("uso: node scripts/check-deploy.mjs <url-do-deploy>");
  process.exit(2);
}

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};

const checks = [
  { name: "/ (landing)", path: "/", expect: [200] },
  { name: "/login", path: "/login", expect: [200] },
  { name: "/dashboard sem sessão", path: "/dashboard", expect: [307, 302], redirect: "manual" },
];

let failed = 0;

for (const check of checks) {
  try {
    const response = await fetch(base + check.path, {
      headers,
      redirect: check.redirect ?? "follow",
    });
    const ok = check.expect.includes(response.status);
    console.log(`${ok ? "ok  " : "FALHA"} ${check.name} → ${response.status}`);
    if (!ok) failed++;
  } catch (error) {
    console.log(`FALHA ${check.name} → ${error.message}`);
    failed++;
  }
}

try {
  const response = await fetch(base + "/api/health", { headers });
  const body = await response.json();
  const ok = response.status === 200 && body.rls === true && body.db === "up";
  console.log(
    `${ok ? "ok  " : "FALHA"} /api/health → ${response.status} db=${body.db} rls=${body.rls} (${body.latencyMs}ms)`,
  );
  if (!ok) {
    failed++;
    if (body.rls === false) {
      console.error(
        "       A aplicação está conectada com um papel que ignora RLS. Revise APP_DATABASE_URL.",
      );
    }
  }
} catch (error) {
  console.log(`FALHA /api/health → ${error.message}`);
  failed++;
}

console.log(failed === 0 ? "\ndeploy íntegro" : `\n${failed} verificação(ões) falharam`);
process.exit(failed === 0 ? 0 : 1);
