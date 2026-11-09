import { createAdminClient, lazyClient } from "@nextgen/db";

/**
 * Cliente dono das tabelas de autenticação.
 *
 * É o único ponto do código com BYPASSRLS: o login precisa ler o usuário pelo e-mail
 * antes de existir sessão (e portanto antes de existir contexto de escola). Ver a
 * migration 0004_auth_owner_bypass.
 *
 * Preguiçoso como o cliente de runtime: sem `DATABASE_URL` o import não derruba a rota,
 * e o erro do login diz qual variável falta em vez de virar 500 no carregamento.
 */
export const authDb = lazyClient(createAdminClient);

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
