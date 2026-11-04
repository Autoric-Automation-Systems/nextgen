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
export function dbConfigPresence(env: Record<string, string | undefined> = process.env) {
  return {
    appDatabaseUrl: Boolean(env.APP_DATABASE_URL),
    databaseUrl: Boolean(env.DATABASE_URL),
    pooled: /[?&]pgbouncer=true/.test(env.APP_DATABASE_URL ?? env.DATABASE_URL ?? ""),
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
    blobPublic: Boolean(env.BLOB_PUBLIC_READ_WRITE_TOKEN),
    blobPrivate: Boolean(env.BLOB_PRIVATE_READ_WRITE_TOKEN),
  };
}
