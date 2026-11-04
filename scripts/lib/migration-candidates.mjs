/**
 * Quais URLs de conexão direta vale tentar para migrar.
 *
 * Fica separado do script para poder ser testado: é a parte que erra em silêncio se
 * o host estiver rotacionado, e o sintoma (migração não aplicada) aparece longe daqui.
 */

const PASSWORD_NAMES = ["APP_DB_PASSWORD", "NEXTGEN_APP_PASSWORD", "PGPASSWORD_APP"];

export function pickPassword(env = process.env) {
  for (const name of PASSWORD_NAMES) {
    if (env[name]) return { name, value: env[name] };
  }
  return undefined;
}

/**
 * Neon separa as duas conexões por `-pooler` no host: `ep-x-pooler.regiao` é a pooled,
 * `ep-x.regiao` é a direta. Tirar o sufixo é como se chega ao mesmo servidor sem a
 * variável unpooled.
 */
export function stripPooler(url) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("-pooler")) return undefined;
    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function hostUrl(host, env) {
  if (!host) return undefined;
  const database = env.PGDATABASE ?? "neondb";
  const params = host.includes("pooler") ? "sslmode=require&pgbouncer=true" : "sslmode=require";
  return `postgresql://${env.PGUSER ?? "postgres"}@${host}/${database}?${params}`;
}

export function candidates(env = process.env) {
  const list = [];
  const add = (name, value) => {
    if (value && !list.some((item) => item.value === value)) list.push({ name, value });
  };

  add("DATABASE_URL_UNPOOLED", env.DATABASE_URL_UNPOOLED);
  add("POSTGRES_URL_NON_POOLING", env.POSTGRES_URL_NON_POOLING);
  add("DIRECT_URL", env.DIRECT_URL);
  add("PGHOST_UNPOOLED", hostUrl(env.PGHOST_UNPOOLED, env));
  add("DATABASE_URL sem -pooler", stripPooler(env.DATABASE_URL));
  // Último recurso: pooled costuma recusar DDL, mas quando é a única que responde
  // ainda vale tentar em vez de ficar sem migração.
  add("DATABASE_URL", env.DATABASE_URL);

  return list;
}
