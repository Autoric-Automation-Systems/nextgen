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
