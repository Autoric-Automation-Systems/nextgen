/**
 * Quem opera a plataforma NextGen.
 *
 * Duas fontes, ambas no servidor:
 * - `PLATFORM_ADMIN_EMAILS`: lista em variável de ambiente, lida no login. Serve para o
 *   primeiro acesso — antes de existir alguém dentro do sistema para conceder o papel.
 * - `users.is_platform_staff`: coluna no banco, checada junto. Existe porque revogar
 *   acesso de uma pessoa não pode depender de um redeploy; remover da env exige deploy e
 *   não deixa rastro de quando o acesso acabou.
 *
 * A união é intencional: env adiciona, coluna mantém. Nenhuma das duas remove a outra.
 *
 * Esta lista nunca chega ao cliente. Enviá-la ao navegador entregaria o alvo de phishing
 * mais óbvio do produto.
 */

/**
 * Separa por vírgula, ponto e vírgula, espaço ou quebra de linha — o que a pessoa
 * colar no painel da Vercel costuma trazer junto.
 */
export function parseEmailAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];

  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.includes("@")),
    ),
  ];
}

export function platformAdminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseEmailAllowlist(env.PLATFORM_ADMIN_EMAILS);
}

export type PlatformAdminInput = {
  email: string;
  /** `users.is_platform_staff`, já lido do banco. */
  persisted?: boolean;
  env?: NodeJS.ProcessEnv;
};

/**
 * Falha fechada: env ausente, vazia ou malformada não promove ninguém. Um `*` aqui
 * prometeria acesso total por erro de digitação, então é ignorado.
 */
export function isPlatformAdmin({ email, persisted = false, env = process.env }: PlatformAdminInput): boolean {
  if (persisted) return true;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  return platformAdminEmails(env).includes(normalized);
}
