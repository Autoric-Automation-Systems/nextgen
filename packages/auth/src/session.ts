import { prisma, withTenant } from "@nextgen/db";
import type { Actor, Role } from "@nextgen/core";
import { isPlatformAdmin } from "./platform-admin";

export type MembershipSummary = {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  role: Role;
};

export type ResolvedSession = {
  userId: string;
  name: string;
  email: string;
  actor: Actor;
  /** Escola ativa. Nula só na operação da plataforma, que não pertence a tenant. */
  schoolId: string | null;
  memberships: MembershipSummary[];
  isPlatformAdmin: boolean;
};

/**
 * Vínculos do usuário. Roda antes de existir tenant: a política `self_read` de
 * `memberships` e a `member_directory` de `schools` liberam só o que o seletor de
 * escola precisa.
 */
export async function listMemberships(userId: string): Promise<MembershipSummary[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    const rows = await tx.membership.findMany({
      where: { userId, status: "active" },
      orderBy: { createdAt: "asc" },
    });

    const result: MembershipSummary[] = [];
    for (const row of rows) {
      const school = await tx.school.findUnique({
        where: { id: row.schoolId },
        select: { slug: true, tradeName: true },
      });
      if (!school) continue;
      result.push({
        schoolId: row.schoolId,
        schoolSlug: school.slug,
        schoolName: school.tradeName,
        role: row.role as Role,
      });
    }
    return result;
  });
}

/**
 * `users.is_platform_staff`. Roda antes do tenant existir: a política `self_or_same_school`
 * de `users` libera a própria linha com `app.user_id` no contexto.
 */
async function loadPlatformStaffFlag(userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isPlatformStaff: true } });
    return user?.isPlatformStaff ?? false;
  });
}

/** IDs dos alunos sob responsabilidade do usuário, na escola dada. */
async function guardianStudentIds(userId: string, schoolId: string): Promise<string[]> {
  return withTenant({ schoolId, userId }, async (tx) => {
    const guardian = await tx.guardian.findFirst({ where: { userId, deletedAt: null } });
    if (!guardian) return [];
    const links = await tx.studentGuardian.findMany({
      where: { guardianId: guardian.id },
      select: { studentId: true },
    });
    return links.map((link) => link.studentId);
  });
}

export type ResolveInput = {
  userId: string;
  name: string;
  email: string;
  preferredSchoolId?: string | null;
  /** Já resolvido por quem chama, para o teste poder injetar o ambiente. */
  platformStaff?: boolean;
};

/**
 * Materializa no banco o que veio da variável de ambiente.
 *
 * A lista em env é imutável sem redeploy e invisível para a RLS. Gravar o sinal em
 * `users.is_platform_staff` resolve as duas coisas: a política de diretório de escolas
 * passa a valer, e revogar o acesso vira um `update` — sem esperar deploy e com registro
 * de quando acabou. Falhar aqui não impede o login: a sessão já foi resolvida pela env.
 */
async function grantPlatformStaff(userId: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
      await tx.user.update({ where: { id: userId }, data: { isPlatformStaff: true } });
    });
  } catch {
    // Coluna é conveniência para a RLS e para a revogação; a env continua valendo.
  }
}

/**
 * Resolve a escola ativa e monta o ator. A escola vem do vínculo no banco, nunca
 * de um parâmetro do cliente — o `preferredSchoolId` só escolhe entre vínculos
 * existentes.
 */
export async function resolveSession(input: ResolveInput): Promise<ResolvedSession | null> {
  const [memberships, platformStaff] = await Promise.all([
    listMemberships(input.userId),
    input.platformStaff === undefined ? loadPlatformStaffFlag(input.userId) : input.platformStaff,
  ]);

  const platformAdmin = isPlatformAdmin({ email: input.email, persisted: platformStaff });
  if (platformAdmin && !platformStaff) await grantPlatformStaff(input.userId);

  // Sem vínculo, só quem opera a plataforma entra. Qualquer outro é conta órfã: o login
  // funciona e o sistema não tem o que mostrar, então a sessão não existe.
  if (memberships.length === 0) {
    if (!platformAdmin) return null;

    return {
      userId: input.userId,
      name: input.name,
      email: input.email,
      actor: { kind: "platform", userId: input.userId, role: "platform_support" },
      schoolId: null,
      memberships: [],
      isPlatformAdmin: true,
    };
  }

  const membership =
    memberships.find((m) => m.schoolId === input.preferredSchoolId) ?? memberships[0]!;

  const actor: Actor =
    membership.role === "guardian"
      ? {
          kind: "guardian",
          userId: input.userId,
          role: "guardian",
          schoolId: membership.schoolId,
          studentIds: await guardianStudentIds(input.userId, membership.schoolId),
        }
      : {
          kind: "member",
          userId: input.userId,
          role: membership.role,
          schoolId: membership.schoolId,
        };

  return {
    userId: input.userId,
    name: input.name,
    email: input.email,
    actor,
    schoolId: membership.schoolId,
    memberships,
    isPlatformAdmin: platformAdmin,
  };
}

export class AccessDeniedError extends Error {
  constructor(message = "acesso negado") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function requireSession(session: ResolvedSession | null): ResolvedSession {
  if (!session) throw new AccessDeniedError("sessão sem vínculo ativo");
  return session;
}
