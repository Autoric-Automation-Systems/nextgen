import { authDb, hasPassword } from "./auth-db";

export type AccessContext = {
  /** Já escolheu senha: o e-mail que sai é o de redefinição, não o de convite. */
  hasPassword: boolean;
  /** Escola do vínculo ativo, quando existe um só. Nula em conta multi-escola. */
  schoolName: string | null;
};

/**
 * O que o e-mail de acesso precisa saber sobre quem vai recebê-lo.
 *
 * O `sendResetPassword` do Better Auth não recebe contexto de intenção — só o usuário e o
 * link. A intenção é deduzida do estado da conta (tem credencial ou não) e o nome da
 * escola vem do vínculo, não de um parâmetro do chamador: assim o convite enviado pelo
 * cadastro de aluno e o reenviado pela equipe dizem a mesma coisa.
 */
export async function accessContext(userId: string): Promise<AccessContext> {
  const [withPassword, memberships] = await Promise.all([
    hasPassword(userId),
    authDb.membership.findMany({
      where: { userId, status: "active" },
      select: { school: { select: { tradeName: true } } },
      take: 2,
    }),
  ]);

  // Duas escolas: escolher uma seria mentir sobre a origem do convite.
  const schoolName = memberships.length === 1 ? memberships[0]!.school.tradeName : null;

  return { hasPassword: withPassword, schoolName };
}
