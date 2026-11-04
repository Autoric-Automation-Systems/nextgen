#!/usr/bin/env node
/**
 * Verifica um deploy já no ar. Sem dependências: basta
 * `node scripts/check-deploy.mjs <url>`.
 *
 * Sai com: 0 íntegro, 1 falha real, 2 uso incorreto, 3 deploy protegido
 * (não dá para verificar).
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");

if (!base) {
  console.error("uso: node scripts/check-deploy.mjs <url-do-deploy>");
  process.exit(2);
}

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : {};

const checks = [
  { name: "/ (landing)", path: "/", status: [200], marker: "NextGen" },
  { name: "/login", path: "/login", status: [200], marker: "acesso" },
  { name: "/dashboard sem sessão", path: "/dashboard", status: [302, 307] },
  { name: "/api/health", path: "/api/health", status: [200], json: true },
];

let failed = 0;
let blocked = false;

/**
 * Redirect seguido esconde a porta trancada: o SSO da Vercel responde 200 na
 * página de login. Por isso nenhuma requisição segue redirect aqui.
 */
function isProtection(status, location) {
  return (
    (status === 302 || status === 307 || status === 301 || status === 308) &&
    Boolean(location?.includes("vercel.com/sso-api"))
  );
}

for (const check of checks) {
  try {
    const response = await fetch(base + check.path, { headers, redirect: "manual" });
    const location = response.headers.get("location");

    if (isProtection(response.status, location)) {
      console.log(`BLOQ ${check.name} → ${response.status} para o SSO da Vercel`);
      blocked = true;
      continue;
    }

    const statusOk = check.status.includes(response.status);
    let detail = "";

    if (statusOk && check.json) {
      const body = await response.json().catch(() => null);
      const healthy = body?.db === "up" && body?.rls === true;
      detail = body
        ? `db=${body.db} rls=${body.rls} mail=${body.mail} ${body.latencyMs}ms`
        : "corpo inválido";
      if (!healthy) {
        failed++;
        console.log(`FALHA ${check.name} → ${response.status} ${detail}`);
        if (body?.rls === false) {
          console.log(
            "       A aplicação conectou com papel que ignora RLS (superusuário ou BYPASSRLS).\n" +
              "       Revise APP_DATABASE_URL: o isolamento entre escolas não está valendo.",
          );
        }
        continue;
      }
    } else if (statusOk && check.marker) {
      const html = await response.text();
      if (!html.includes(check.marker)) {
        failed++;
        console.log(`FALHA ${check.name} → 200, mas sem "${check.marker}" no HTML`);
        continue;
      }
    }

    console.log(`${statusOk ? "ok  " : "FALHA"} ${check.name} → ${response.status} ${detail}`.trimEnd());
    if (!statusOk) failed++;
  } catch (error) {
    console.log(`FALHA ${check.name} → ${error.message}`);
    failed++;
  }
}

if (blocked) {
  console.log(
    [
      "",
      "Deployment Protection está ativa: o deploy não é legível de fora.",
      "  Settings → Deployment Protection → Vercel Authentication → Only Preview Deployments",
      "  ou rode com VERCEL_AUTOMATION_BYPASS_SECRET=<segredo do Protection Bypass>.",
    ].join("\n"),
  );
  process.exit(3);
}

console.log(failed === 0 ? "\ndeploy íntegro" : `\n${failed} verificação(ões) falharam`);
process.exit(failed === 0 ? 0 : 1);
