import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerCard } from "@/components/player-card";
import { requireSession } from "@/lib/session";
import { getStudentCard, listStudents } from "@/lib/queries";
import { resolveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Revisão do card: as duas variantes lado a lado, com o mesmo dado.
 *
 * Serve para a administração da plataforma conferir a regra sem depender de vínculo com
 * escola: a versão interna mostra tudo; a pública omite comportamento, nome completo e
 * idade. Aluno abaixo de 12 aparece sem nota nas duas.
 */
export default async function CardPreviewPage() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) redirect("/dashboard");

  const workspace = await resolveWorkspace(session);
  if (!workspace) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 28, margin: 0 }}>Nada para revisar</h1>
        <p className="muted" style={{ margin: 0 }}>
          A escola de demonstração não existe neste banco. Rode <code>pnpm db:seed:demo</code> para criá-la.
        </p>
      </div>
    );
  }

  const roster = await listStudents({ schoolId: workspace.schoolId, userId: session.userId });
  const subject = roster.find((student) => student.age >= 12 && student.publicCard) ?? roster.find((student) => student.age >= 12) ?? roster[0];

  if (!subject) {
    return <p className="muted">A escola de demonstração não tem alunos.</p>;
  }

  const student = await getStudentCard({ schoolId: workspace.schoolId, userId: session.userId }, subject.id);
  if (!student) return <p className="muted">Aluno de demonstração não encontrado.</p>;

  const cardData = {
    nickname: student.nickname,
    category: student.category,
    position: student.position,
    jerseyNumber: student.jerseyNumber,
    age: student.age,
    schoolName: workspace.schoolName,
    cycleLabel: student.cycleLabel,
    scores: student.scores,
    previousScores: student.previousScores,
    consentNote: student.consent === "granted" ? "perfil autorizado pelo responsável" : null,
  };

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Como o card é montado</h1>
        <p className="muted" style={{ margin: 0 }}>
          Exemplo com {student.fullName} ({student.age} anos), da escola de demonstração. Clique em um aluno para
          abrir a ficha completa.
        </p>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="stack">
          <h2 className="section-title">Uso interno</h2>
          <PlayerCard data={cardData} variant="internal" />
          <p className="muted" style={{ margin: 0 }}>
            Coordenação, professor e responsável. Inclui comportamento e a nota geral — quando o aluno tem 12 anos
            ou mais.
          </p>
        </section>

        <section className="stack">
          <h2 className="section-title">Página pública</h2>
          <PlayerCard data={cardData} variant="public" />
          <p className="muted" style={{ margin: 0 }}>
            Só técnico, físico e tático, e só com consentimento de imagem vigente. Sem nome completo, sem idade e
            sem horário de treino.
          </p>
        </section>
      </div>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 10 }}>
          Alunos da demonstração
        </h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {roster.map((entry) => (
            <li key={entry.id} style={{ marginBottom: 6 }}>
              <Link href={`/alunos/${entry.id}`}>{entry.name}</Link>
              <span className="muted">
                {" "}
                · {entry.age} anos · {entry.category ?? "sem categoria"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
