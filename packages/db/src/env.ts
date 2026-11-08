/**
 * Resolve as URLs do banco a partir de vários nomes de variável.
 *
 * A integração Neon da Vercel cria `DATABASE_URL_UNPOOLED`, `PGHOST`, `PGPASSWORD`
 * e companhia — nomes que este projeto não escolheu. Exigir um nome específico
 * transforma variável existente em variável "faltando", e o erro que aparece é
 * "não configurada", que não diz nada sobre o nome.
 *
 * Nada aqui devolve o valor da senha: só a URL montada, que nunca é logada.
 */

type Env = Record<string, string | undefined>;

const POOLED_PARAMS = "sslmode=require&pgbouncer=true&connection_limit=1";

/**
 * Limpa o que a colagem na Vercel costuma trazer junto: espaço, quebra de linha e aspas
 * em volta do valor.
 *
 * O Prisma recusa a URL inteira com "must start with the protocol `postgresql://`", que
 * descreve o sintoma errado: o protocolo está lá, o que veio antes dele é que não. E
 * como o formulário de login engole o erro, o usuário só vê "link enviado".
 */
export function normalizeUrl(url: string): string {
  let value = url.trim();

  const quoted =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  if (quoted) value = value.slice(1, -1).trim();

  return value;
}

/** O que está errado no formato, sem devolver o valor. Vai para o health. */
export function urlAnomaly(url: string | undefined): "espaco" | "aspas" | "protocolo" | null {
  if (!url) return null;
  if (url !== url.trim()) return "espaco";
  if (/^["']/.test(url)) return "aspas";
  if (!/^postgres(ql)?:\/\//i.test(url)) return "protocolo";

  return null;
}

/**
 * Banco gerenciado exige TLS. URL sem `sslmode` faz o Prisma conectar em texto puro, o
 * servidor derruba a conexão e o erro que aparece é P1001 "can't reach database server" —
 * que manda procurar host errado quando o problema é o parâmetro que falta.
 */
function withTls(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("sslmode")) return parsed.toString();
    // Loopback não tem TLS: o Postgres da CI e o de quem roda os testes recusam o
    // handshake, e o erro sai como P1011 "server does not support TLS".
    if (isLoopbackHost(parsed.hostname)) return parsed.toString();
    parsed.searchParams.set("sslmode", "require");
    return parsed.toString();
  } catch {
    return url;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "localhost" || host === "::1" || host === "0.0.0.0" || host.startsWith("127.");
}

/** Como o TLS foi resolvido. Vai para o health: `ausente` explica P1001 enganoso. */
export function sslMode(url: string | undefined): string {
  if (!url) return "ausente";
  try {
    return new URL(url).searchParams.get("sslmode") ?? "ausente";
  } catch {
    return "invalida";
  }
}

/** `""` conta como ausente: a Vercel grava variável vazia, não remove. */
function pick(env: Env, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value) return value;
  }
  return undefined;
}

export const DIRECT_URL_NAMES = [
  "DATABASE_URL_MIGRATE",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "NEON_DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
];

export const POOLED_URL_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
];

export const APP_PASSWORD_NAMES = [
  "APP_DB_PASSWORD",
  "NEXTGEN_APP_PASSWORD",
  "PGPASSWORD_APP",
];

/** Conexão dona das tabelas: migração, seed, script manual. Sempre direta. */
/** O que o Prisma aceita como conexão. Qualquer outra coisa derruba o cliente inteiro. */
function isPostgresUrl(value: string): boolean {
  return /^postgres(ql)?:\/\//i.test(value);
}

/**
 * Primeira conexão direta **utilizável**, não a primeira presente.
 *
 * Uma variável declarada com valor que não é URL (`DATABASE_URL_MIGRATE` apontando para
 * outra coisa, por exemplo) derrubava tudo antes de chegar ao banco: o Prisma valida a
 * datasource na construção e a exceção só aparece na primeira query.
 */
export function directDatabaseUrl(env: Env = process.env): string | undefined {
  for (const name of DIRECT_URL_NAMES) {
    const value = env[name];
    if (!value) continue;

    const clean = normalizeUrl(value);
    if (isPostgresUrl(clean)) return clean;
  }

  return undefined;
}

/** Variáveis de conexão direta presentes que o Prisma recusaria. Vai para o health. */
export function ignoredDirectSources(env: Env = process.env): string[] {
  return DIRECT_URL_NAMES.filter((name) => {
    const value = env[name];
    return Boolean(value) && !isPostgresUrl(normalizeUrl(value!));
  });
}

/** Valor cru, sem normalizar: o health precisa ver o defeito que a normalização esconde. */
export function rawDirectDatabaseUrl(env: Env = process.env): string | undefined {
  return pick(env, DIRECT_URL_NAMES);
}

/** Nome da variável que forneceu a conexão direta utilizável. */
export function directUrlSource(env: Env = process.env): string | undefined {
  return DIRECT_URL_NAMES.find((name) => env[name] && isPostgresUrl(normalizeUrl(env[name]!)));
}

/**
 * Conexão da aplicação: precisa ser o papel `nextgen_app`, não o dono das tabelas.
 *
 * A ordem importa. `DATABASE_URL` vem antes de `PGHOST` porque é a URL que a aplicação
 * já usou e que funcionou: o host da integração pode estar rotacionado ou suspenso, e
 * nesse caso montar a URL a partir dele derruba um site que estava no ar.
 */
export function appDatabaseUrl(env: Env = process.env): string | undefined {
  const explicit = pick(env, ["APP_DATABASE_URL"]);
  if (explicit) return withTls(normalizeUrl(explicit));

  const password = pick(env, APP_PASSWORD_NAMES);
  if (!password) return undefined;

  const ownerUrl = pick(env, POOLED_URL_NAMES);
  if (ownerUrl) {
    const clean = normalizeUrl(ownerUrl);
    // Troca só as credenciais: host, porta, banco e parâmetros seguem os do dono.
    try {
      const url = new URL(clean);
      url.username = "nextgen_app";
      url.password = password;
      return url.toString();
    } catch {
      // URL fora do formato padrão: cai para a montagem abaixo.
    }
  }

  const host = pick(env, ["PGHOST", "PGHOST_UNPOOLED"]);
  const database = pick(env, ["PGDATABASE"]) ?? "nextgen";
  if (!host) return undefined;

  const params = host.includes("pooler") ? POOLED_PARAMS : "sslmode=require";
  return `postgresql://nextgen_app:${encodeURIComponent(password)}@${host}/${database}?${params}`;
}

/**
 * Todas as URLs que podem servir a aplicação, na ordem em que o runtime tenta.
 *
 * Existe porque as variáveis podem apontar para endpoints diferentes, e um deles pode
 * estar morto (projeto recriado, endpoint rotacionado). Sem essa lista, o diagnóstico
 * vira adivinhação sobre qual nome está errado.
 */
export function appDatabaseCandidates(
  env: Env = process.env,
): { source: string; url: string }[] {
  const list: { source: string; url: string }[] = [];
  const password = pick(env, APP_PASSWORD_NAMES);

  const add = (source: string, url: string | undefined) => {
    if (url && !list.some((item) => item.url === url)) list.push({ source, url });
  };

  add("APP_DATABASE_URL", env.APP_DATABASE_URL && withTls(env.APP_DATABASE_URL));

  if (password) {
    for (const name of POOLED_URL_NAMES) {
      const value = env[name];
      if (!value) continue;
      try {
        const url = new URL(value);
        url.username = "nextgen_app";
        url.password = password;
        add(`${name} + APP_DB_PASSWORD`, withTls(url.toString()));
      } catch {
        // URL fora do formato padrão: ignora este nome.
      }
    }
  }

  // Último recurso: o próprio papel dono. RLS continua valendo por FORCE, mas o dono lê
  // qualquer tabela — o health mostra `appIsOwner: true` para não passar despercebido.
  for (const name of POOLED_URL_NAMES) add(name, env[name] && normalizeUrl(env[name]));

  return list;
}

/**
 * O que o health pode devolver. Não há URL aqui de propósito: `appUrl` carrega a
 * senha, e um objeto com ela acaba serializado em algum log ou resposta.
 */
export type DatabaseConfig = {
  /** De onde veio a URL da aplicação. */
  appSource: "APP_DATABASE_URL" | "montada" | "DATABASE_URL" | "ausente";
  /** Papel que a aplicação usa. Nome de usuário apenas — nunca a senha. */
  appUser?: string;
  appIsOwner: boolean;
  hasDirectUrl: boolean;
  /** Qual variável forneceu o host: decide a depuração quando a conexão falha. */
  hostSource?: "APP_DATABASE_URL" | "DATABASE_URL" | "PGHOST";
};

/** Lê só o usuário da URL. Serve para o health provar qual papel conectou. */
export function userFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^:@/]+)/i.exec(url);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function describe(
  appUrl: string | undefined,
  source: DatabaseConfig["appSource"],
  env: Env,
  hostSource: DatabaseConfig["hostSource"],
): DatabaseConfig {
  const appUser = userFromUrl(appUrl);
  return {
    appSource: source,
    appUser,
    appIsOwner: appUser !== "nextgen_app",
    hasDirectUrl: Boolean(directDatabaseUrl(env)),
    hostSource,
  };
}

export function resolveDatabaseConfig(env: Env = process.env): DatabaseConfig {
  const app = appDatabaseUrl(env);
  if (app) {
    const hostSource = env.APP_DATABASE_URL
      ? "APP_DATABASE_URL"
      : pick(env, POOLED_URL_NAMES)
        ? "DATABASE_URL"
        : "PGHOST";
    return describe(app, env.APP_DATABASE_URL ? "APP_DATABASE_URL" : "montada", env, hostSource);
  }

  const owner = pick(env, POOLED_URL_NAMES);
  if (owner) return describe(owner, "DATABASE_URL", env, "DATABASE_URL");

  return { appSource: "ausente", appIsOwner: true, hasDirectUrl: Boolean(directDatabaseUrl(env)) };
}
