import { connect } from "node:net";
import {
  appDatabaseCandidates,
  appDatabaseUrl,
  directDatabaseUrl,
  directUrlSource,
  ignoredDirectSources,
  rawDirectDatabaseUrl,
  urlAnomaly,
  resolveDatabaseConfig,
  sslMode,
} from "@nextgen/db";

/**
 * Traduz falha de conexão do Prisma em uma frase curta e segura para o `/api/health`.
 *
 * A mensagem crua do driver não vai para a resposta: `P1001` inclui host e porta do
 * banco, e o health é público. Só o código é lido — nunca a URL nem a mensagem.
 */
const HINTS: Record<string, string> = {
  P1000: "autenticação recusada — usuário ou senha do banco errados",
  P1001: "não alcançou o servidor — host errado, projeto Neon suspenso ou IP bloqueado",
  P1002: "timeout ao conectar — verifique se a URL é a pooled e tem pgbouncer=true",
  P1003: "banco inexistente — confira o nome no fim da URL",
  P1008: "timeout do banco — projeto Neon suspenso por inatividade",
  P1010: "acesso negado ao banco para este usuário",
  P1013: "string de conexão inválida — precisa começar com postgresql://",
  P1017: "o servidor fechou a conexão — provável falta de sslmode=require",
  P2021: "tabela não existe — as migrações não foram aplicadas neste banco",
  P2024: "pool esgotado — reduza connection_limit",
};

/** Apaga URL, credenciais e host antes de qualquer mensagem sair do servidor. */
export function redactSecrets(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'`]+/gi, "<url>")
    .replace(/\b[a-z0-9-]+\.(?:neon\.tech|vercel\.app|amazonaws\.com)\b/gi, "<host>")
    .replace(/\b(?:re|sk|pk)_[A-Za-z0-9_]{8,}\b/g, "<token>");
}

/** O código `P1xxx`/`P2xxx` do Prisma vem no texto, não em `.code`. */
export function prismaCode(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);
  return /P\d{4}/.exec(message)?.[0];
}

export function describeDbFailure(error: unknown): string {
  if (!(error instanceof Error)) return "falha desconhecida";

  const code = (error as { code?: unknown; errorCode?: unknown }).errorCode
    ?? (error as { code?: unknown }).code;

  if (typeof code === "string" && HINTS[code]) return `${code}: ${HINTS[code]}`;

  // Erros que nascem antes de qualquer conexão: configuração ausente ou inválida.
  if (/não configurada/.test(error.message)) return "URL do banco não configurada";
  if (/could not locate the Query Engine|Unable to require/i.test(error.message)) {
    return "query engine do Prisma ausente no bundle da função";
  }
  if (/built on Vercel/i.test(error.message)) {
    return "engineType não declarado — Prisma exige engineType no build da Vercel";
  }
  if (/Environment variable not found/.test(error.message)) return "variável de ambiente do banco ausente";

  // Sem código P1001: o Prisma só embrulha. TCP pode até aceitar e o handshake morrer
  // (endpoint suspenso, host de outro projeto). Culpar senha aqui manda para o lugar errado.
  if (/Can't reach database server|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(error.message)) {
    return "host do banco não alcançado (endpoint divergente, suspenso ou handshake recusado)";
  }

  if (code) return `${String(code)}: falha ao conectar`;
  return error.name;
}

/**
 * Mensagem completa (com a cadeia de `cause`), redigida e truncada. Sem ela o
 * diagnóstico pára em "Invalid invocation" e não diz qual runtime de engine faltou.
 */
export function describeDbDetail(error: unknown): string {
  if (!(error instanceof Error)) return "sem detalhe";

  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < 3) {
    if (current.message) parts.push(current.message);
    current = (current as { cause?: unknown }).cause;
    depth += 1;
  }

  return redactSecrets(parts.join(" | "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

/** Presença das variáveis, sem expor valor. Ajuda a distinguir "faltou" de "errado". */
/**
 * O health não repete a lógica de resolução de URL: ele pergunta ao `@nextgen/db`
 * qual papel a aplicação realmente usa. Duas implementações divergem, e a que
 * aparece na tela passa a mentir.
 */
export function dbConfigPresence(env: Record<string, string | undefined> = process.env) {
  const config = resolveDatabaseConfig(env);
  return {
    ...config,
    // Nomes que a integração Neon cria, para não parecer ausente o que está lá.
    unpooledUrl: Boolean(directDatabaseUrl(env)),
    pgIntegration: Boolean(env.PGHOST || env.PGPASSWORD),
    // `ausente` aqui explica um P1001 que manda procurar host errado.
    ssl: sslMode(appDatabaseUrl(env)),
    // O Prisma recusa espaço ou aspas antes do protocolo culpando o protocolo. O valor
    // da URL nunca sai daqui; só o formato.
    directUrlShape: urlAnomaly(rawDirectDatabaseUrl(env)) ?? "ok",
    directUrlSource: directUrlSource(env),
    directUrlIgnored: ignoredDirectSources(env),
    pooledUrlShape: urlAnomaly(env.DATABASE_URL ?? env.POSTGRES_URL) ?? "ok",
  };
}

/**
 * Presença das variáveis de aplicação (não do banco). Todas são obrigatórias para
 * login e upload; faltando qualquer uma, a tela quebra sem dizer o motivo.
 */
/**
 * Variáveis sem as quais o app não serve: sem segredo o Better Auth lança em toda
 * página autenticada, e o sintoma é um 500 sem texto. Listar o nome evita a caça.
 */
export function missingAppConfig(env: Record<string, string | undefined> = process.env): string[] {
  const missing: string[] = [];

  if (!env.BETTER_AUTH_SECRET) missing.push("BETTER_AUTH_SECRET");

  // SMTP dispensa `MAIL_FROM` (o remetente cai para `EMAIL_USER`); o Resend não.
  const smtp = Boolean(env.EMAIL_USER && env.EMAIL_PASS);
  const resend = Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
  if (!smtp && !resend) missing.push("EMAIL_USER + EMAIL_PASS (ou RESEND_API_KEY + MAIL_FROM)");

  return missing;
}

export function appConfigPresence(env: Record<string, string | undefined> = process.env) {
  return {
    authSecret: Boolean(env.BETTER_AUTH_SECRET),
    authUrl: Boolean(env.BETTER_AUTH_URL),
    mailFrom: Boolean(env.MAIL_FROM),
    resendKey: Boolean(env.RESEND_API_KEY),
    emailUser: Boolean(env.EMAIL_USER),
    emailPass: Boolean(env.EMAIL_PASS),
    blobPublic: Boolean(env.BLOB_PUBLIC_READ_WRITE_TOKEN),
    blobPrivate: Boolean(env.BLOB_PRIVATE_READ_WRITE_TOKEN),
  };
}

/**
 * Abre um TCP em cada endpoint candidato e diz qual responde.
 *
 * "Can't reach database server" não distingue host errado de endpoint suspenso, e as
 * variáveis da integração podem apontar para endpoints diferentes. O teste de porta
 * resolve isso sem exigir senha nem consultar o banco.
 *
 * Só o primeiro rótulo do host sai na resposta: identifica o endpoint e não expõe o host
 * completo nem as credenciais.
 */
function endpointOf(url: string): { host: string; port: number } | undefined {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: Number(parsed.port || 5432) };
  } catch {
    return undefined;
  }
}

function label(host: string): string {
  const first = host.split(".")[0] ?? host;
  return first.length <= 16 ? first : `${first.slice(0, 15)}…`;
}

function reachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function probeDatabaseEndpoints(
  timeoutMs = 2500,
  env: Record<string, string | undefined> = process.env,
) {
  const candidates = appDatabaseCandidates(env);

  return Promise.all(
    candidates.slice(0, 4).map(async (candidate) => {
      const endpoint = endpointOf(candidate.url);
      if (!endpoint) return { source: candidate.source, endpoint: "inválida", up: false };

      return {
        source: candidate.source,
        endpoint: label(endpoint.host),
        port: endpoint.port,
        up: await reachable(endpoint.host, endpoint.port, timeoutMs),
      };
    }),
  );
}

/**
 * Testa as combinações de conexão quando o Prisma não alcança o banco.
 *
 * "Can't reach database server" é o mesmo texto para senha errada, papel inexistente,
 * pooler recusando e rede bloqueada. Aqui cada combinação (pooler/direto × papel de
 * aplicação/dono) é tentada com timeout curto, e o código do erro do Prisma separa os
 * casos: P1000 é autenticação, P1001 é rede, P2021 é schema.
 *
 * Só roda no caminho de falha — nunca no health saudável.
 */
export async function probeConnections(timeoutMs = 6000) {
  const { createAppClient } = await import("@nextgen/db");
  const appUrl = appDatabaseUrl();
  const ownerPooled = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  const direct = directDatabaseUrl();

  const attempts = [
    { name: "pooler + nextgen_app", url: appUrl },
    { name: "pooler + dono", url: ownerPooled },
    { name: "direto + dono", url: direct },
  ];

  const withTimeout = (promise: Promise<unknown>) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);

  return Promise.all(
    attempts.map(async ({ name, url }) => {
      if (!url) return { name, ok: false, code: "sem URL" };

      const client = createAppClient(url);
      try {
        await withTimeout(client.$queryRaw`select 1`);
        return { name, ok: true, code: "ok" };
      } catch (error) {
        const code = prismaCode(error) ?? "desconhecido";
        return { name, ok: false, code, detail: describeDbFailure(error) };
      } finally {
        await client.$disconnect().catch(() => {});
      }
    }),
  );
}

/**
 * O papel de runtime existe e pode logar?
 *
 * Consulta feita com o papel dono, que conecta — sem isso, "não conecta" continua sendo
 * a única informação, e a causa pode ser papel inexistente ou senha trocada, que pedem
 * ações opostas: criar no console versus corrigir a variável.
 */
export async function roleState() {
  const ownerUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!ownerUrl) return { checked: false, reason: "sem conexão de dono" };

  const { createAppClient } = await import("@nextgen/db");
  const client = createAppClient(ownerUrl);

  try {
    const rows = await client.$queryRaw<
      {
        current: string;
        exists: boolean;
        can_login: boolean;
        owner_createrole: boolean;
        owner_super: boolean;
      }[]
    >`
      select
        current_user as current,
        exists (select 1 from pg_roles where rolname = 'nextgen_app') as exists,
        coalesce((select rolcanlogin from pg_roles where rolname = 'nextgen_app'), false) as can_login,
        (select rolcreaterole from pg_roles where rolname = current_user) as owner_createrole,
        (select rolsuper from pg_roles where rolname = current_user) as owner_super
    `;

    return { checked: true, ...rows[0] };
  } catch (error) {
    return { checked: false, reason: describeDbFailure(error) };
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

/**
 * Estado do schema visto pelo dono, quando o papel de aplicação não conecta.
 *
 * Sem isso, um papel bloqueado esconde se as migrações rodaram: a resposta diz só
 * "não conecta", e o operador não sabe se falta migrar ou só liberar o papel.
 */
export async function schemaState() {
  const ownerUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!ownerUrl) return { checked: false };

  const { createAppClient } = await import("@nextgen/db");
  const client = createAppClient(ownerUrl);

  try {
    const rows = await client.$queryRaw<{ applied: number; failed: number; tables: number }[]>`
      select
        (select count(*) from _prisma_migrations
          where finished_at is not null and rolled_back_at is null)::int as applied,
        (select count(*) from _prisma_migrations
          where finished_at is null and rolled_back_at is null)::int as failed,
        (select count(*) from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE')::int as tables
    `;

    return { checked: true, ...rows[0] };
  } catch (error) {
    return { checked: false, reason: describeDbFailure(error) };
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

/**
 * O que o último build registrou em `deploy_log`.
 *
 * Só existe porque o script de migração grava ali: o log do build fica na Vercel e não é
 * alcançável daqui, então sem essa linha o diagnóstico termina em "não sei se rodou".
 */
async function queryAsOwner<T>(run: (client: OwnerClient) => Promise<T>): Promise<T | null> {
  const ownerUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!ownerUrl) return null;

  const { createAppClient } = await import("@nextgen/db");
  const client = createAppClient(ownerUrl) as unknown as OwnerClient;

  try {
    return await run(client);
  } catch {
    return null;
  } finally {
    await client.$disconnect().catch(() => {});
  }
}

type OwnerClient = {
  $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $disconnect: () => Promise<void>;
};

export async function lastDeploy() {
  return (
    (await queryAsOwner(
      (client) => client.$queryRaw<{ at: Date; status: string; detail: string | null }[]>`
        select at, status, detail from public.deploy_log order by id desc limit 2
      `,
    )) ?? []
  );
}

/**
 * Últimas tentativas de envio de e-mail.
 *
 * "O e-mail não chegou" tem três causas com a mesma tela: destinatário sem usuário (o
 * `disableSignUp` barra antes de enviar), senha de app recusada e remetente inválido.
 * A lista distingue as três — inclusive o caso em que nada foi tentado.
 */
export async function mailRecent() {
  return (
    (await queryAsOwner(
      (client) => client.$queryRaw<
        { at: Date; kind: string; recipient: string; status: string; detail: string | null }[]
      >`
        select at, kind, recipient, status, detail from public.mail_log order by id desc limit 3
      `,
    )) ?? []
  );
}

/**
 * Quantos usuários existem. Zero explica sozinho um link mágico que nunca sai: o Better
 * Auth está com `disableSignUp`, então e-mail desconhecido não gera envio nem erro visível.
 */
export async function userCount(): Promise<number | null> {
  const rows = await queryAsOwner(
    (client) => client.$queryRaw<{ total: bigint }[]>`select count(*)::bigint as total from public.users`,
  );

  if (!rows || rows.length === 0) return null;
  return Number(rows[0]!.total);
}

/**
 * Problemas que não derrubam o banco mas quebram o uso.
 *
 * Ficam separados de `missing` porque o serviço responde: o que não funciona é o login de
 * quem chega, e um `ok` sem aviso manda procurar o problema no lugar errado.
 */
export function usageWarnings(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const warnings: string[] = [];

  // Em produção o domínio estável do projeto substitui `BETTER_AUTH_URL` sem prejuízo.
  // Sem ele, o link aponta para a implantação, que responde atrás da proteção da Vercel
  // e recusa a origem do domínio público (`INVALID_ORIGIN`).
  const stableHost = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : null;
  if (!env.BETTER_AUTH_URL && !stableHost && env.VERCEL_URL) {
    warnings.push(
      "sem BETTER_AUTH_URL nem VERCEL_PROJECT_PRODUCTION_URL: o link do e-mail aponta para a URL da implantação e cai na proteção da Vercel",
    );
  }

  return warnings;
}

/**
 * Só o formato da senha do papel de aplicação — nunca o valor.
 *
 * "Papel existe, aceita login, dono conecta, app não" tem uma causa dominante: a senha
 * gravada no banco não é a mesma da variável. Aspas coladas junto e espaço no fim
 * produzem esse estado, e o erro na tela ("can't reach database server") não sugere isso.
 */
export function credentialShape() {
  const raw =
    process.env.APP_DB_PASSWORD ??
    process.env.NEXTGEN_APP_PASSWORD ??
    process.env.PGPASSWORD_APP;

  if (!raw) return { present: false as const };

  return {
    present: true as const,
    length: raw.length,
    whitespace: /\s/.test(raw),
    quotes: /['"]/.test(raw),
    nonAscii: /[^\x20-\x7e]/.test(raw),
  };
}

/** Traduz o conjunto de sondagens em uma causa provável, não em sintoma. */
export function connectionHint(
  connections: { name: string; ok: boolean; code?: string }[],
  role: { checked?: boolean; can_login?: boolean },
): string | undefined {
  const app = connections.find((item) => item.name.includes("nextgen_app"));
  const owner = connections.find((item) => item.name === "pooler + dono");

  if (!app || app.ok) return undefined;

  // `sem URL` é ausência de configuração, não credencial errada. Sem esta checagem o
  // health culpava a senha de APP_DB_PASSWORD num ambiente onde ela nem existia —
  // e o papel certo (que só pode ser lido com a variável presente) ficava de fora.
  if (app.code === "sem URL") {
    return "APP_DATABASE_URL (ou APP_DB_PASSWORD) não existe neste ambiente — sem ela o app conecta como dono e a RLS depende só de FORCE ROW LEVEL SECURITY; cadastre a variável no ambiente que serve esta URL e redeploye";
  }

  // NOLOGIN explica P1000 melhor que senha: o papel recusa qualquer credencial.
  if (role.checked && role.can_login === false) {
    return "o papel nextgen_app existe mas está sem login — no SQL Editor do Neon: alter role nextgen_app login password '<a mesma senha de APP_DB_PASSWORD>';";
  }

  if (app.code === "P1000") {
    return "o papel nextgen_app existe e aceita login, mas a senha da URL não confere — resete em Neon > Roles e atualize APP_DATABASE_URL";
  }

  // Último ramo: a aplicação falhou sem código, o dono conecta. Isso é host diferente,
  // não senha — o Prisma não teria como autenticar num servidor que não responde.
  if (role.can_login && owner?.ok) {
    return "a URL da aplicação aponta para um host que não responde, enquanto o dono conecta em outro endpoint — compare o host de APP_DATABASE_URL com o de DATABASE_URL (ou remova APP_DATABASE_URL e deixe só APP_DB_PASSWORD para o app herdar o host do dono)";
  }

  return undefined;
}
