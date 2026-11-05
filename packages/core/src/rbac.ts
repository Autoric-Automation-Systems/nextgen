/**
 * RBAC. O papel vem de `membership.role` (doc 06 §5) e o escopo limita o alcance:
 * professor enxerga as turmas dele, responsável enxerga os filhos dele.
 *
 * A checagem é declarativa e pura, sem acesso a banco: quem chama passa o ator já
 * resolvido pela sessão.
 */

export const ROLES = ["admin", "coordinator", "teacher", "guardian", "platform_support"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  "school:read",
  "school:write",
  "unit:write",
  "room:write",
  "teacher:manage",
  "student:read",
  "student:write",
  "guardian:read",
  "guardian:write",
  "pickup_person:write",
  "enrollment:read",
  "enrollment:write",
  "attendance:read",
  "attendance:write",
  "content:read",
  "content:write",
  "assessment:read",
  "assessment:write",
  "assessment:approve",
  "health:read_emergency",
  "health:read_clinical",
  "health:write",
  "consent:read",
  "consent:grant",
  "charge:read",
  "charge:write",
  "expense:read",
  "expense:write",
  "report:read",
  "audit:read",
  "platform:impersonate",
  "platform:admin",
] as const;
export type Action = (typeof ACTIONS)[number];

export type Actor =
  | { kind: "anonymous" }
  /**
   * Operação da plataforma (NextGen), não de uma escola. Sem `schoolId` de propósito:
   * quem opera o SaaS não pertence a tenant e não age dentro de um sem impersonação
   * explícita. Enxerga estrutura e cadastro; nunca prontuário de aluno.
   */
  | { kind: "platform"; userId: string; role: "platform_support" }
  | {
      kind: "member";
      userId: string;
      role: Role;
      schoolId: string;
    }
  | {
      kind: "guardian";
      userId: string;
      role: "guardian";
      schoolId: string;
      studentIds: string[];
    };

const PERMISSIONS: Record<Action, Role[]> = {
  "school:read": ["admin", "coordinator", "teacher", "guardian", "platform_support"],
  "school:write": ["admin"],
  "unit:write": ["admin"],
  "room:write": ["admin"],
  "teacher:manage": ["admin"],

  "student:read": ["admin", "coordinator", "teacher", "guardian", "platform_support"],
  "student:write": ["admin", "coordinator"],
  "guardian:read": ["admin", "coordinator", "guardian"],
  "guardian:write": ["admin", "coordinator"],
  "pickup_person:write": ["admin", "coordinator", "guardian"],

  "enrollment:read": ["admin", "coordinator", "teacher", "guardian"],
  "enrollment:write": ["admin", "coordinator"],

  "attendance:read": ["admin", "coordinator", "teacher", "guardian"],
  "attendance:write": ["admin", "coordinator", "teacher"],

  "content:read": ["admin", "coordinator", "teacher", "guardian"],
  "content:write": ["admin", "coordinator", "teacher"],

  "assessment:read": ["admin", "coordinator", "teacher", "guardian"],
  "assessment:write": ["admin", "coordinator", "teacher"],
  "assessment:approve": ["admin", "coordinator"],

  "health:read_emergency": ["admin", "coordinator", "teacher"],
  // prontuário/anamnese: professor não vê. Plataforma também não.
  "health:read_clinical": ["admin", "coordinator"],
  "health:write": ["admin", "coordinator"],

  "consent:read": ["admin", "coordinator", "guardian"],
  "consent:grant": ["guardian"],

  "charge:read": ["admin", "guardian"],
  "charge:write": ["admin"],
  "expense:read": ["admin"],
  "expense:write": ["admin"],

  "report:read": ["admin", "coordinator"],
  "audit:read": ["admin"],
  "platform:impersonate": ["platform_support"],
  "platform:admin": ["platform_support"],
};

export type AccessRequest = {
  action: Action;
  /** Aluno alvo, quando a ação é sobre um aluno específico. */
  studentId?: string;
  /** Escola alvo, quando a ação não é da escola da sessão. */
  schoolId?: string;
};

export function can(actor: Actor, request: AccessRequest): boolean {
  if (actor.kind === "anonymous") return false;

  // Administração da plataforma não tem escola: qualquer ação com alvo de escola
  // exigiria impersonação, então aqui a resposta é não.
  if (actor.kind === "platform") {
    if (request.schoolId || request.studentId) return false;
    return PERMISSIONS[request.action].includes("platform_support");
  }

  const allowedRoles = PERMISSIONS[request.action];
  if (!allowedRoles.includes(actor.role)) return false;

  // Ninguém age sobre escola diferente da própria, exceto impersonação explícita.
  if (request.schoolId && request.schoolId !== actor.schoolId) return false;

  // Responsável só alcança os próprios filhos.
  if (actor.kind === "guardian" && request.studentId && !actor.studentIds.includes(request.studentId)) {
    return false;
  }

  // Professor não vê dado clínico nem financeiro, mesmo sendo "member".
  if (actor.role === "teacher" && request.action === "health:read_clinical") return false;

  return true;
}

export function assertCan(actor: Actor, request: AccessRequest): void {
  if (!can(actor, request)) {
    throw new Error(`acesso negado: ${request.action}`);
  }
}

/** Ações que exigem 2FA (doc 06 §5). */
export function requiresMfa(role: Role): boolean {
  return role === "admin" || role === "platform_support";
}

/** Papel efetivo do ator, para rotular a interface. */
export function actorRole(actor: Actor): Role | null {
  return actor.kind === "anonymous" ? null : actor.role;
}
