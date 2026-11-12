import { withTenant } from "@nextgen/db";
import type { Role } from "@nextgen/core";

export type TeamMemberRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: "invited" | "active" | "revoked";
  groups: string[];
  joinedAt: string;
};

/**
 * Quem trabalha na escola.
 *
 * Responsáveis ficam de fora de propósito: são centenas, não são equipe, e listá-los aqui
 * transformaria a tela de equipe em diretório de famílias.
 */
export async function listTeam(ctx: { schoolId: string; userId: string }): Promise<TeamMemberRow[]> {
  return withTenant(ctx, async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { role: { in: ["admin", "coordinator", "teacher"] } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    const teacherIds = memberships.filter((m) => m.role === "teacher").map((m) => m.userId);
    const links = teacherIds.length
      ? await tx.classGroupTeacher.findMany({
          where: { userId: { in: teacherIds }, toDate: null, classGroup: { deletedAt: null } },
          select: { userId: true, classGroup: { select: { name: true } } },
        })
      : [];

    const groupsByUser = new Map<string, string[]>();
    for (const link of links) {
      const list = groupsByUser.get(link.userId) ?? [];
      list.push(link.classGroup.name);
      groupsByUser.set(link.userId, list);
    }

    return memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role as Role,
      status: membership.status,
      groups: (groupsByUser.get(membership.userId) ?? []).sort((a, b) => a.localeCompare(b, "pt-BR")),
      joinedAt: membership.createdAt.toISOString(),
    }));
  });
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administração",
  coordinator: "Coordenação",
  teacher: "Professor",
  guardian: "Responsável",
  platform_support: "Suporte NextGen",
};

/** Cargos que a escola distribui pelo convite. `guardian` nasce do cadastro de aluno. */
export const INVITABLE_ROLES = ["teacher", "coordinator", "admin"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}
