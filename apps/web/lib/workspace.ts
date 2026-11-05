import { withUser } from "@nextgen/db";
import type { ResolvedSession } from "@nextgen/auth";
import { can, type Action, type Role } from "@nextgen/core";

/**
 * Escola sobre a qual a tela está falando.
 *
 * Existe porque a administração da plataforma não tem vínculo, e toda tela do painel exige
 * escola. Nesse caso o contexto é a escola de demonstração, em modo leitura e rotulado como
 * tal: quem opera o SaaS vê a interface com dado fictício, sem ganhar escrita em escola
 * nenhuma.
 */
export type Workspace = {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  isDemo: boolean;
  /** Papel nesta escola. Nulo na visão de demonstração. */
  role: Role | null;
  readOnly: boolean;
  can: (action: Action) => boolean;
};

export type SchoolDirectoryEntry = {
  id: string;
  name: string;
  slug: string;
  role: Role | null;
};

export const DEMO_SCHOOL_SLUG = "escola-teste";

export async function resolveWorkspace(session: ResolvedSession): Promise<Workspace | null> {
  const membership = session.memberships.find((entry) => entry.schoolId === session.schoolId);

  if (session.schoolId && membership) {
    return {
      schoolId: membership.schoolId,
      schoolName: membership.schoolName,
      schoolSlug: membership.schoolSlug,
      isDemo: false,
      role: membership.role,
      readOnly: false,
      can: (action) => can(session.actor, { action }),
    };
  }

  if (!session.isPlatformAdmin) return null;

  const demo = await withUser(session.userId, (tx) =>
    tx.school.findFirst({
      where: { slug: DEMO_SCHOOL_SLUG, status: "active" },
      select: { id: true, tradeName: true, slug: true },
    }),
  );

  // Sem demonstração semeada, a plataforma ainda entra — só não tem escola para mostrar.
  if (!demo) return null;

  return {
    schoolId: demo.id,
    schoolName: demo.tradeName,
    schoolSlug: demo.slug,
    isDemo: true,
    role: null,
    readOnly: true,
    can: () => false,
  };
}

/** Escolas que o usuário enxerga: os vínculos dele, ou o diretório se for plataforma. */
export async function listVisibleSchools(session: ResolvedSession): Promise<SchoolDirectoryEntry[]> {
  if (session.memberships.length > 0) {
    return session.memberships.map((membership) => ({
      id: membership.schoolId,
      name: membership.schoolName,
      slug: membership.schoolSlug,
      role: membership.role,
    }));
  }

  if (!session.isPlatformAdmin) return [];

  const rows = await withUser(session.userId, (tx) =>
    tx.school.findMany({
      orderBy: { tradeName: "asc" },
      select: { id: true, tradeName: true, slug: true },
    }),
  );

  return rows.map((row) => ({ id: row.id, name: row.tradeName, slug: row.slug, role: null }));
}
