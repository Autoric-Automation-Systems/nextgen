import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { listLessonPlanClasses, listLessonPlans } from "@/lib/pedagogy";
import { archiveLessonPlan } from "../pedagogia/actions";
import { NewLessonPlanForm } from "./new-plan-form";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export default async function LessonPlansPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  if (workspace.role === "guardian") {
    return (
      <p className="muted">
        O plano de aula é ferramenta da equipe. O que chega para a família é a avaliação e o
        conteúdo publicado.
      </p>
    );
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const teacherFilter = workspace.role === "teacher" ? { teacherId: session.userId } : {};
  const [plans, classes] = await Promise.all([
    listLessonPlans(ctx, teacherFilter),
    listLessonPlanClasses(ctx, teacherFilter),
  ]);

  const canWrite = workspace.can("content:write");

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Planos de aula</h1>
          <p className="muted" style={{ margin: 0 }}>
            {plans.length} plano(s). O plano é do professor que vai dar a aula — a coordenação
            enxerga todos.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/pedagogia">
          Biblioteca
        </Link>
      </div>

      {canWrite ? (
        <details className="panel">
          <summary>Novo plano</summary>
          <div className="panel-body">
            <NewLessonPlanForm classes={classes} />
          </div>
        </details>
      ) : null}

      {plans.length === 0 ? (
        <p className="notice">
          Nenhum plano ainda. Um plano curto — objetivo, aquecimento, parte principal, jogo e
          volta à calma — já muda o treino de terça.
        </p>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {plans.map((plan) => (
            <section className="card" key={plan.id}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontSize: 16, margin: 0 }}>
                    {plan.title}{" "}
                    <span className="badge neutral">{plan.classGroupName}</span>
                  </h2>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {dateFormatter.format(plan.plannedFor)} · {plan.durationMinutes} min ·{" "}
                    {plan.authorName}
                    {plan.materialCount > 0 ? ` · ${plan.materialCount} conteúdo(s)` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <form action={archiveLessonPlan}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="btn btn-ghost" type="submit">
                      Arquivar
                    </button>
                  </form>
                ) : null}
              </div>

              {plan.objective ? (
                <p style={{ margin: "10px 0 0", fontSize: 14 }}>
                  <strong>Objetivo:</strong> {plan.objective}
                </p>
              ) : null}

              <dl style={{ margin: "10px 0 0", display: "grid", gap: 6, fontSize: 14 }}>
                {[
                  ["Aquecimento", plan.warmup],
                  ["Parte principal", plan.mainPart],
                  ["Jogo", plan.gamePart],
                  ["Volta à calma", plan.cooldown],
                  ["Observações", plan.notes],
                ]
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt style={{ fontWeight: 600, display: "inline" }}>{label}: </dt>
                      <dd style={{ display: "inline", margin: 0, whiteSpace: "pre-wrap" }}>{value}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
