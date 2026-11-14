import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { listSubjects } from "@/lib/pedagogy";
import { NewSubjectForm } from "./new-subject-form";

export const dynamic = "force-dynamic";

export default async function PedagogyPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  // A biblioteca é da equipe: o responsável recebe o conteúdo publicado na área do aluno.
  if (workspace.role === "guardian") {
    return (
      <p className="muted">
        A biblioteca pedagógica é da equipe da escola. O material publicado para a sua turma
        aparece na área do aluno — fale com a secretaria se algo não estiver lá.
      </p>
    );
  }

  const subjects = await listSubjects({ schoolId: workspace.schoolId, userId: session.userId });
  const canStructure = workspace.can("content:structure");
  const totals = subjects.reduce(
    (sum, subject) => ({
      chapters: sum.chapters + subject.chapterCount,
      materials: sum.materials + subject.materialCount,
      published: sum.published + subject.publishedCount,
    }),
    { chapters: 0, materials: 0, published: 0 },
  );

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Pedagogia</h1>
          <p className="muted" style={{ margin: 0 }}>
            {subjects.length} matéria(s), {totals.chapters} capítulo(s) e {totals.materials}{" "}
            conteúdo(s) em {workspace.schoolName}. {totals.published} já publicado(s) para as
            famílias.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/aulas">
          Planos de aula
        </Link>
      </div>

      {canStructure ? (
        <details className="panel">
          <summary>Nova matéria</summary>
          <div className="panel-body">
            <NewSubjectForm />
          </div>
        </details>
      ) : (
        <p className="muted">
          Você alimenta o conteúdo dos capítulos. Criar matéria e capítulo é da coordenação.
        </p>
      )}

      {subjects.length === 0 ? (
        <p className="notice">
          Nenhuma matéria ainda. Comece pelo que a escola já ensina — por exemplo
          &quot;Fundamentos Técnicos&quot;, &quot;Tática&quot; e &quot;Físico&quot; — e pendure os
          capítulos embaixo.
        </p>
      ) : (
        <section className="card card-flush">
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Matéria</th>
                  <th>Capítulos</th>
                  <th>Conteúdos</th>
                  <th>Publicados</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td data-label="Matéria">
                      <Link href={`/pedagogia/${subject.id}`}>{subject.name}</Link>
                      {subject.description ? (
                        <div className="muted" style={{ marginTop: 2 }}>
                          {subject.description}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Capítulos">{subject.chapterCount}</td>
                    <td data-label="Conteúdos">{subject.materialCount}</td>
                    <td data-label="Publicados">
                      {subject.publishedCount > 0 ? (
                        <span className="badge">{subject.publishedCount}</span>
                      ) : (
                        <span className="muted">rascunho</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
