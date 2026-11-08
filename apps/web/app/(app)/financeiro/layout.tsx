import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { FinanceTabs } from "./tabs";

export const dynamic = "force-dynamic";

/**
 * Casca do módulo financeiro: guarda de acesso uma vez e as seções em abas.
 *
 * A guarda fica no layout porque a regra é a mesma para todas as telas filhas. Cada página
 * ainda confere por conta própria (`financeContext`) — layout não protege rota, só decora.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);

  if (!workspace) {
    return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  }

  // `charge:read` também vale para o responsável, mas só sobre as cobranças dos próprios
  // filhos; a visão da escola (totais, inadimplência, despesas) é da administração.
  if (session.actor.kind === "guardian" || !workspace.can("charge:read")) {
    return (
      <p className="muted">
        O financeiro é da administração da escola. Suas mensalidades ficam em{" "}
        <Link href="/meus-boletos">Mensalidades</Link>.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 4px" }}>Financeiro</h1>
        <p className="muted" style={{ margin: 0 }}>
          {workspace.schoolName} — o dinheiro cai na conta da escola; a NextGen só organiza a
          cobrança.
        </p>
      </div>

      <FinanceTabs />

      {children}
    </div>
  );
}
