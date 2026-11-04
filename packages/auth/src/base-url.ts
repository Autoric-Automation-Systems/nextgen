/**
 * Endereço público usado para montar o link do e-mail e validar a origem da requisição.
 *
 * Em produção vale o domínio estável do projeto, não `VERCEL_URL`: aquela aponta para a
 * implantação, responde atrás da proteção da Vercel e faz o navegador no domínio público
 * ser recusado com `INVALID_ORIGIN`. Nas demais, a URL da implantação é a certa — cada
 * preview tem a sua e o link precisa voltar para ela.
 *
 * Módulo sem efeitos colaterais: o health precisa disto sem instanciar o cliente de auth.
 */
export function defaultBaseURL(env: Record<string, string | undefined> = process.env): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;

  const stable = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  const host = stable ?? env.VERCEL_URL;
  if (host) return `https://${host}`;

  return "http://localhost:3000";
}

/**
 * Origens aceitas pelo login: o endereço base mais os domínios do próprio projeto.
 *
 * Um projeto responde por vários nomes — o domínio estável, o da implantação e eventuais
 * aliases. Se só o `baseURL` for aceito, abrir o site por outro deles resulta em
 * `INVALID_ORIGIN` no login, com a mesma tela de "link enviado". Todos os nomes abaixo
 * apontam para este mesmo código; `BETTER_AUTH_TRUSTED_ORIGINS` cobre domínio próprio.
 */
export function trustedOriginsFrom(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const hosts = [
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
  ].filter((host): host is string => Boolean(host));

  const extra = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...hosts.map((host) => `https://${host}`), ...extra])];
}
