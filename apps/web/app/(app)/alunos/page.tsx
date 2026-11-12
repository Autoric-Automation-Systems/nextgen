import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listStudents } from "@/lib/queries";
import { resolveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const REGIME_LABEL: Record<string, string> = {
  child: "criança (<12)",
  teen: "adolescente (12-15)",
  own_account: "conta própria (16-17)",
  adult: "adulto",
};

export default async function StudentsPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  const students = await listStudents({
    schoolId: workspace.schoolId,
    userId: session.userId,
    studentIds: session.actor.kind === "guardian" ? session.actor.studentIds : undefined,
  });

  const canWrite = workspace.can("student:write");

  return (
    <div className="stack">
      <div>
        <div className="page-head">
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Alunos</h1>
          {canWrite ? (
            <Link className="btn" href="/alunos/novo">
              Cadastrar aluno
            </Link>
          ) : null}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {students.length} aluno(s) em {workspace.schoolName}.{" "}
          {session.actor.kind === "guardian"
            ? "Como responsável, você vê só os alunos sob sua guarda."
            : "Clique no nome para abrir o card. O domínio é filtrado pela RLS: pedir outra escola não retorna nada."}
        </p>
      </div>

      <section className="card card-flush">
        <div className="table-scroll table-cards">
        <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Idade</th>
              <th>Turma</th>
              <th>Responsável</th>
              <th>Consentimento</th>
              <th>Card público</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td data-label="Aluno">
                  <div className="cell-value">
                    <Link href={`/alunos/${student.id}`}>
                      <strong>{student.name}</strong>
                    </Link>
                    {student.nickname ? <span className="muted">{student.nickname}</span> : null}
                  </div>
                </td>
                <td data-label="Idade">
                  <div className="cell-value">
                    {student.age}
                    <span className="muted">{REGIME_LABEL[student.regime]}</span>
                  </div>
                </td>
                <td data-label="Turma" className="muted">
                  {student.classGroup ?? "—"}
                </td>
                <td data-label="Responsável" className="muted">{student.guardianNames.join(", ") || "—"}</td>
                <td data-label="Consentimento">
                  {student.consent === "granted" ? (
                    <span className="badge">ok</span>
                  ) : student.consent === "revoked" ? (
                    <span className="badge danger">revogado</span>
                  ) : (
                    <span className="badge warn">pendente</span>
                  )}
                </td>
                <td data-label="Card público">
                  {student.publicCard ? (
                    <span className="badge">publicado</span>
                  ) : (
                    <span className="badge neutral">desligado</span>
                  )}
                </td>
              </tr>
            ))}
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum aluno cadastrado ainda.{" "}
                  {canWrite ? <Link href="/alunos/novo">Cadastre o primeiro</Link> : null}
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
