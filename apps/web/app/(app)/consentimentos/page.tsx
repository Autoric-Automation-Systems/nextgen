import Link from "next/link";
import { requiresHighlightedConsent } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { PURPOSE_LABELS, listConsents, type StudentConsentView } from "@/lib/consent";
import { PurposeRow } from "./purpose-row";

export const dynamic = "force-dynamic";

export default async function ConsentsPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  const isGuardian = workspace.can("consent:grant");
  const canRead = workspace.can("consent:read");
  if (!isGuardian && !canRead) {
    return <p className="muted">Só o responsável vê os próprios consentimentos.</p>;
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };

  // O escopo do responsável vem da sessão (`actor.studentIds`), nunca de parâmetro de URL.
  const guardian = isGuardian && session.actor.kind === "guardian" ? session.actor : null;
  const students = guardian
    ? await listConsents(ctx, { studentIds: guardian.studentIds })
    : await listConsents(ctx, { onlyPending: true });

  const pending = students.filter((student) => student.pending.length > 0);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>
          {guardian ? "Consentimentos" : "Consentimentos pendentes"}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {guardian
            ? "O que você autoriza hoje vale só para o que está marcado. Cada finalidade pode ser revogada a qualquer momento, com efeito imediato."
            : "Alunos sem o termo obrigatório ou com matrícula em rascunho. Quem autoriza é o responsável, pelo próprio login — a escola não aceita termo no lugar da família."}
        </p>
      </div>

      {guardian && pending.length > 0 ? (
        <p className="notice">
          {pending.length === 1
            ? "Um aluno seu tem pendência de consentimento. Sem o termo de matrícula, a vaga não é liberada."
            : `${pending.length} alunos seus têm pendência de consentimento. Sem o termo de matrícula, a vaga não é liberada.`}
        </p>
      ) : null}

      {students.length === 0 ? (
        <p className="muted">
          {guardian
            ? "Nenhum aluno vinculado ao seu login. Se isso estiver errado, fale com a secretaria da escola."
            : "Nenhuma pendência de consentimento. Todas as famílias autorizaram o termo obrigatório."}
        </p>
      ) : null}

      {students.map((student) => (
        <StudentCard key={student.studentId} student={student} readOnly={!guardian} />
      ))}

      {guardian ? null : (
        <p className="muted">
          <Link href="/alunos">← Voltar para alunos</Link>
        </p>
      )}
    </div>
  );
}

function StudentCard({ student, readOnly }: { student: StudentConsentView; readOnly: boolean }) {
  const highlight = requiresHighlightedConsent(student.age);

  return (
    <section className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <h2 className="section-title">{student.nickname ? `${student.name} (${student.nickname})` : student.name}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {student.age} anos
            {student.classGroup ? ` · ${student.classGroup}` : " · sem turma"}
            {student.enrollmentStatus ? ` · matrícula ${enrollmentLabel(student.enrollmentStatus)}` : ""}
          </p>
        </div>
        <span className={student.pending.length > 0 ? "badge warn" : "badge"}>
          {student.pending.length > 0 ? "termo obrigatório pendente" : "termo obrigatório ok"}
        </span>
      </div>

      {highlight ? (
        <p className="notice">
          {student.name.split(" ")[0]} tem menos de 12 anos: o consentimento precisa ser específico e em
          destaque, por finalidade. Nada vem pré-marcado.
        </p>
      ) : null}

      <div className="consent-list">
        {student.purposes.map((purpose) => (
          <PurposeRow
            key={purpose.code}
            studentId={student.studentId}
            purpose={purpose}
            label={PURPOSE_LABELS[purpose.code] ?? { name: purpose.name, description: purpose.description, consequence: "" }}
            highlight={highlight}
            readOnly={readOnly}
            note={
              highlight && purpose.code === "public_card"
                ? "O card público só entra no ar a partir dos 12 anos. Guardar a autorização agora é permitido — e ela passa a valer sozinha no aniversário."
                : undefined
            }
          />
        ))}
      </div>

      {student.cardEnabled ? (
        <p className="muted" style={{ margin: 0 }}>
          O card público deste aluno está no ar. Revogar a imagem em divulgação desliga o card na hora.
        </p>
      ) : null}
    </section>
  );
}

function enrollmentLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "pendente",
    waitlist: "lista de espera",
    active: "ativa",
    suspended: "suspensa",
    completed: "concluída",
    cancelled: "cancelada",
  };
  return labels[status] ?? status;
}
