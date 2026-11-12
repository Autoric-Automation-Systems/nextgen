import Link from "next/link";
import { formatBRL } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { listClassGroups, listUnits } from "@/lib/class-groups";
import { listPlans } from "@/lib/billing";
import { StudentForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  if (!workspace.can("student:write")) {
    return <p className="muted">Só a secretaria cadastra aluno.</p>;
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const [groups, plans, units] = await Promise.all([
    listClassGroups(ctx),
    listPlans(ctx),
    listUnits(ctx),
  ]);

  return (
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: "0 0 4px" }}>
          <Link href="/alunos">← Alunos</Link>
        </p>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Cadastrar aluno</h1>
        <p className="muted" style={{ margin: 0 }}>
          Aluno menor de idade não tem conta própria: o cadastro cria o aluno, vincula o
          responsável e envia o convite de acesso para ele.
        </p>
      </div>

      {units.length === 0 ? (
        <p className="notice">
          A escola ainda não tem unidade cadastrada. Dá para cadastrar o aluno agora, mas sem
          unidade não existe turma para matricular.
        </p>
      ) : null}

      <section className="card">
        <StudentForm
          groups={groups.map((group) => ({
            id: group.id,
            name: `${group.name} · ${group.schedule}`,
          }))}
          plans={plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            monthlyAmount: formatBRL(plan.monthlyAmount),
          }))}
        />
      </section>
    </div>
  );
}
