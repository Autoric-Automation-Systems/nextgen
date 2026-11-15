import type { Role } from "@nextgen/core";

/**
 * Rótulos e cargos do convite, sem banco.
 *
 * `team.ts` importa `@nextgen/db`; formulário de convite é componente de cliente e não
 * pode arrastar o Prisma para o navegador. Regra que a tela precisa fica aqui.
 */
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
