import { createAdminClient } from "@nextgen/db";

/**
 * Cliente dono das tabelas de autenticação.
 *
 * É o único ponto do código com BYPASSRLS: o login precisa ler o usuário pelo e-mail
 * antes de existir sessão (e portanto antes de existir contexto de escola). Ver a
 * migration 0004_auth_owner_bypass.
 */
export const authDb = createAdminClient();

/**
 * O usuário já escolheu uma senha? Quem foi cadastrado pela escola ainda não tem
 * credencial, e por isso o primeiro acesso dele passa por `/esqueci-senha`
 * (ou pelo link de cadastro) em vez do formulário de login.
 */
export async function hasPassword(userId: string): Promise<boolean> {
  const account = await authDb.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });

  return Boolean(account?.password);
}
