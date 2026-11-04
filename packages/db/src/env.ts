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

/** Conexão da aplicação. Precisa ser o papel `nextgen_app`, não o dono. */
export function appDatabaseUrl(env: Env = process.env): string | undefined {
  const explicit = pick(env, ["APP_DATABASE_URL"]);
  if (explicit) return explicit;

  // Sem URL pronta: monta a do papel de aplicação em cima do host da integração.
  // O host do Neon aceita qualquer papel; o que muda é o usuário da URL.
  const host = pick(env, ["PGHOST", "PGHOST_UNPOOLED"]);
  const database = pick(env, ["PGDATABASE"]) ?? "nextgen";
  const password = pick(env, APP_PASSWORD_NAMES);
  if (!host || !password) return undefined;

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
};

/** Lê só o usuário da URL. Serve para o health provar qual papel conectou. */
export function userFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^:@/]+)/i.exec(url);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function describe(appUrl: string | undefined, source: DatabaseConfig["appSource"], env: Env): DatabaseConfig {
  const appUser = userFromUrl(appUrl);
  return {
    appSource: source,
    appUser,
    appIsOwner: appUser !== "nextgen_app",
    hasDirectUrl: Boolean(directDatabaseUrl(env)),
  };
}

export function resolveDatabaseConfig(env: Env = process.env): DatabaseConfig {
  const app = appDatabaseUrl(env);
  if (app) return describe(app, env.APP_DATABASE_URL ? "APP_DATABASE_URL" : "montada", env);

  const owner = pick(env, POOLED_URL_NAMES);
  if (owner) return describe(owner, "DATABASE_URL", env);

  return { appSource: "ausente", appIsOwner: true, hasDirectUrl: Boolean(directDatabaseUrl(env)) };
}
