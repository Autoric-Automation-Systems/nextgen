import { prisma, withTenant } from "@nextgen/db";
import type { Actor, Role } from "@nextgen/core";

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
  schoolId: string;
  memberships: MembershipSummary[];
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
};

/**
 * Resolve a escola ativa e monta o ator. A escola vem do vínculo no banco, nunca
 * de um parâmetro do cliente — o `preferredSchoolId` só escolhe entre vínculos
 * existentes.
 */
export async function resolveSession(input: ResolveInput): Promise<ResolvedSession | null> {
  const memberships = await listMemberships(input.userId);
  if (memberships.length === 0) return null;

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
