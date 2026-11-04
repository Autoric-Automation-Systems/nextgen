import { connect } from "node:net";
import {
  appDatabaseCandidates,
  appDatabaseUrl,
  directDatabaseUrl,
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
  };
}

/**
 * Presença das variáveis de aplicação (não do banco). Todas são obrigatórias para
 * login e upload; faltando qualquer uma, a tela quebra sem dizer o motivo.
 */
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
