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
export function directDatabaseUrl(env: Env = process.env): string | undefined {
  return pick(env, DIRECT_URL_NAMES);
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
  if (explicit) return explicit;

  const password = pick(env, APP_PASSWORD_NAMES);
  if (!password) return undefined;

  const ownerUrl = pick(env, POOLED_URL_NAMES);
  if (ownerUrl) {
    // Troca só as credenciais: host, porta, banco e parâmetros seguem os do dono.
    try {
      const url = new URL(ownerUrl);
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
