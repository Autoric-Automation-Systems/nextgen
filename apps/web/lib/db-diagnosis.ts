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

export function describeDbFailure(error: unknown): string {
  if (!(error instanceof Error)) return "falha desconhecida";

  const code = (error as { code?: unknown; errorCode?: unknown }).errorCode
    ?? (error as { code?: unknown }).code;

  if (typeof code === "string" && HINTS[code]) return `${code}: ${HINTS[code]}`;

  // Erros que nascem antes de qualquer conexão: configuração ausente ou inválida.
  if (/não configurada/.test(error.message)) return "URL do banco não configurada";
  if (/Environment variable not found/.test(error.message)) return "variável de ambiente do banco ausente";

  return code ? `${String(code)}: falha ao conectar` : error.name;
}

/** Presença das variáveis, sem expor valor. Ajuda a distinguir "faltou" de "errado". */
export function dbConfigPresence(env: Record<string, string | undefined> = process.env) {
  return {
    appDatabaseUrl: Boolean(env.APP_DATABASE_URL),
    databaseUrl: Boolean(env.DATABASE_URL),
    pooled: /[?&]pgbouncer=true/.test(env.APP_DATABASE_URL ?? env.DATABASE_URL ?? ""),
  };
}
