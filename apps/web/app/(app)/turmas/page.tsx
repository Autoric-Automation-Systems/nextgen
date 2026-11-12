import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { listClassGroups, listUnits } from "@/lib/class-groups";
import { NewClassGroupForm } from "./new-class-group-form";

export const dynamic = "force-dynamic";

export default async function ClassGroupsPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  // A RLS isola a escola, não o papel: sem esta linha o responsável leria a turma inteira.
  if (workspace.role === "guardian") {
    return (
      <p className="muted">
        A lista de turmas é da equipe da escola. Seu acesso mostra os dados dos seus filhos em
        Alunos — fale com a secretaria se precisar de algo da turma.
      </p>
    );
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const teacherFilter = workspace.role === "teacher" ? { teacherId: session.userId } : {};
  const [groups, units] = await Promise.all([listClassGroups(ctx, teacherFilter), listUnits(ctx)]);

  const canWrite = workspace.can("enrollment:write");

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Turmas</h1>
          <p className="muted" style={{ margin: 0 }}>
            {groups.length} turma(s) em {workspace.schoolName}. É aqui que o aluno treina: o dia de
            pagamento fica no cadastro dele, não na turma.
          </p>
        </div>
        {canWrite ? (
          <Link className="btn btn-ghost" href="/alunos/novo">
            Cadastrar aluno
          </Link>
        ) : null}
      </div>

      {canWrite ? (
        units.length === 0 ? (
          <p className="notice">
            Antes de abrir turma, cadastre uma unidade com endereço — a turma acontece em algum
            lugar, e o responsável precisa saber onde deixar o aluno.
          </p>
        ) : (
          <details className="panel">
            <summary>Abrir turma</summary>
            <div className="panel-body">
              <NewClassGroupForm units={units} />
            </div>
          </details>
        )
      ) : (
        <p className="muted">Seu perfil enxerga as turmas em modo leitura.</p>
      )}

      <section className="card card-flush">
        <div className="table-scroll table-cards">
          <table>
            <thead>
              <tr>
                <th>Turma</th>
                <th>Horário</th>
                <th>Local</th>
                <th>Professor(es)</th>
                <th>Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id}>
                  <td data-label="Turma">
                    <Link href={`/turmas/${group.id}`}>
                      <strong>{group.name}</strong>
                    </Link>
                  </td>
                  <td data-label="Horário">
                    <div className="cell-value">
                      {group.schedule}
                      {!group.isActive ? <span className="badge neutral">inativa</span> : null}
                    </div>
                  </td>
                  <td data-label="Local" className="muted">
                    {group.unitName}
                    {group.roomName ? ` · ${group.roomName}` : ""}
                  </td>
                  <td data-label="Professor(es)" className="muted">
                    {group.teachers.join(", ") || "sem professor"}
                  </td>
                  <td data-label="Ocupação">
                    <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>
                      <div className="meter" style={{ width: 90 }}>
                        <div
                          className={group.seats === 0 ? "meter-fill is-full" : "meter-fill"}
                          style={{ width: `${group.occupancy}%` }}
                        />
                      </div>
                      <span className="muted">
                        {group.activeCount}/{group.capacity}
                        {group.waitlistCount > 0 ? ` · ${group.waitlistCount} na espera` : ""}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Nenhuma turma ainda. Abra a primeira acima e matricule o aluno nela.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
