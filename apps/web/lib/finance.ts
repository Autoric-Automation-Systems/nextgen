import { competenceLabel, isCompetence } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace, type Workspace } from "@/lib/workspace";
import { currentCompetence } from "@/lib/billing";
import type { ResolvedSession } from "@nextgen/auth";

export type FinanceContext = {
  session: ResolvedSession;
  workspace: Workspace;
  /** Ver a escola é diferente de mexer no dinheiro: quem só lê não vê botão de ação. */
  canWrite: boolean;
  tenant: { schoolId: string; userId: string };
};

/**
 * Porta de entrada do módulo financeiro.
 *
 * `charge:read` inclui o responsável, mas só para as cobranças dos próprios filhos. Todo o
 * módulo é da administração da escola — por isso o papel `guardian` sai aqui, e não em cada
 * tela. Devolver `null` deixa a decisão de "o que mostrar no lugar" com quem chamou.
 */
export async function financeContext(): Promise<FinanceContext | null> {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return null;
  if (session.actor.kind === "guardian" || !workspace.can("charge:read")) return null;

  return {
    session,
    workspace,
    canWrite: workspace.can("charge:write") && !workspace.readOnly,
    tenant: { schoolId: workspace.schoolId, userId: session.userId },
  };
}

/** Competência da URL, caindo no mês corrente quando o parâmetro é inválido ou ausente. */
export function competenceFrom(value: string | undefined): string {
  return isCompetence(value ?? "") ? value! : currentCompetence();
}

export function competenceTitle(competence: string): string {
  return competenceLabel(competence);
}
