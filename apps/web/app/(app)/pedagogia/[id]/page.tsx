import Link from "next/link";
import { notFound } from "next/navigation";
import { uploadsConfigured } from "@nextgen/integrations";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { getSubject } from "@/lib/pedagogy";
import { MATERIAL_KIND_LABEL, formatBytes } from "@/lib/pedagogy-rules";
import { ChapterForm } from "./chapter-form";
import { MaterialForm } from "./material-form";
import { archiveMaterial, setMaterialPublished } from "../actions";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  if (workspace.role === "guardian") {
    return (
      <p className="muted">
        A biblioteca pedagógica é da equipe da escola. O conteúdo publicado aparece na área do
        aluno.
      </p>
    );
  }

  const subject = await getSubject({ schoolId: workspace.schoolId, userId: session.userId }, id);
  if (!subject) notFound();

  const canStructure = workspace.can("content:structure");
  const canWrite = workspace.can("content:write");
  const uploadsEnabled = uploadsConfigured("private");
  const materials = subject.chapters.flatMap((chapter) => chapter.materials);

  return (
    <div className="stack">
      <div>
        <p className="muted" style={{ margin: "0 0 4px" }}>
          <Link href="/pedagogia">Pedagogia</Link> · {subject.chapters.length} capítulo(s) ·{" "}
          {materials.length} conteúdo(s)
        </p>
        <h1 style={{ fontSize: 28, margin: 0 }}>{subject.name}</h1>
        {subject.description ? (
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {subject.description}
          </p>
        ) : null}
      </div>

      {!uploadsEnabled ? (
        <p className="notice">
          O armazenamento de arquivos não está configurado neste ambiente. Texto e link externo
          funcionam; vídeo, áudio, imagem e PDF ficam para quando os tokens do Blob existirem.
        </p>
      ) : null}

      {canStructure ? (
        <details className="panel">
          <summary>Novo capítulo</summary>
          <div className="panel-body">
            <ChapterForm subjectId={subject.id} />
          </div>
        </details>
      ) : null}

      {subject.chapters.length === 0 ? (
        <p className="notice">
          Esta matéria ainda não tem capítulo. O capítulo é o que agrupa os conteúdos de um
          mesmo assunto.
        </p>
      ) : null}

      {subject.chapters.map((chapter) => (
        <section className="card" key={chapter.id}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>{chapter.title}</h2>
              {chapter.summary ? (
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {chapter.summary}
                </p>
              ) : null}
            </div>
            <span className="badge neutral">
              {chapter.materials.length} conteúdo(s)
            </span>
          </div>

          {chapter.materials.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 12 }}>
              {chapter.materials.map((material) => (
                <li
                  key={material.id}
                  style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}
                >
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{material.title}</strong>{" "}
                      <span className="badge neutral">{MATERIAL_KIND_LABEL[material.kind]}</span>{" "}
                      {material.isPublished ? (
                        <span className="badge">publicado</span>
                      ) : (
                        <span className="badge warn">rascunho</span>
                      )}
                      {material.description ? (
                        <p className="muted" style={{ margin: "4px 0 0" }}>
                          {material.description}
                        </p>
                      ) : null}

                      {material.kind === "text" ? (
                        <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontSize: 14 }}>
                          {material.bodyText}
                        </p>
                      ) : null}

                      {material.kind === "link" && material.url ? (
                        <a href={material.url} target="_blank" rel="noreferrer noopener">
                          abrir link
                        </a>
                      ) : null}

                      {material.hasFile ? (
                        <a href={`/api/pedagogia/arquivo/${material.id}`} target="_blank" rel="noreferrer">
                          abrir arquivo
                          {material.sizeBytes ? (
                            <span className="muted"> · {formatBytes(material.sizeBytes)}</span>
                          ) : null}
                        </a>
                      ) : null}

                      {material.kind === "image" && material.hasFile ? (
                        <div style={{ marginTop: 8 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/pedagogia/arquivo/${material.id}`}
                            alt={material.title}
                            style={{ maxWidth: 320, borderRadius: 8 }}
                          />
                        </div>
                      ) : null}
                    </div>

                    {canWrite ? (
                      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                        <form action={setMaterialPublished}>
                          <input type="hidden" name="materialId" value={material.id} />
                          <input type="hidden" name="publish" value={material.isPublished ? "0" : "1"} />
                          <button className="btn btn-ghost" type="submit">
                            {material.isPublished ? "Despublicar" : "Publicar"}
                          </button>
                        </form>
                        <form action={archiveMaterial}>
                          <input type="hidden" name="materialId" value={material.id} />
                          <button className="btn btn-ghost" type="submit">
                            Arquivar
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: "12px 0 0" }}>
              Nenhum conteúdo neste capítulo ainda.
            </p>
          )}

          {canWrite ? (
            <details className="panel" style={{ marginTop: 16 }}>
              <summary>Adicionar conteúdo</summary>
              <div className="panel-body">
                <MaterialForm
                  chapterId={chapter.id}
                  schoolId={workspace.schoolId}
                  uploadsEnabled={uploadsEnabled}
                />
              </div>
            </details>
          ) : null}
        </section>
      ))}
    </div>
  );
}
