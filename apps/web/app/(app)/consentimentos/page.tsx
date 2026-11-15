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

  // Duas perguntas diferentes, e a resposta não é a mesma:
  // - "eu assino termo?" é vínculo de família, não cargo — vale para o dono da escola que
  //   matriculou o filho;
  // - "eu vejo as pendências da escola?" é cargo (administração e coordenação), em leitura.
  const myChildren = session.guardianStudentIds;
  const signsTerms = workspace.can("consent:grant") || myChildren.length > 0;
  const staffView = workspace.role !== "guardian" && workspace.can("consent:read");

  if (!signsTerms && !staffView) {
    return <p className="muted">Só o responsável vê os próprios consentimentos.</p>;
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };

  // O escopo do responsável vem da sessão, nunca de parâmetro de URL.
  const family = myChildren.length > 0 ? await listConsents(ctx, { studentIds: myChildren }) : [];
  const schoolPending = staffView ? await listConsents(ctx, { onlyPending: true }) : [];
  const familyIds = new Set(family.map((student) => student.studentId));
  const othersPending = schoolPending.filter((student) => !familyIds.has(student.studentId));

  const familyPending = family.filter((student) => student.pending.length > 0);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>
          {myChildren.length > 0 ? "Consentimentos" : "Consentimentos pendentes"}
        </h1>
        <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
          {myChildren.length > 0
            ? "O que você autoriza hoje vale só para o que está marcado. Cada finalidade pode ser revogada a qualquer momento, com efeito imediato."
            : "Alunos sem o termo obrigatório ou com matrícula em rascunho. Quem autoriza é o responsável, pelo próprio login — a escola não aceita termo no lugar da família."}
        </p>
      </div>

      {signsTerms && family.length > 0 ? (
        <section className="stack">
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Seus filhos
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              Você assina o termo dos alunos sob sua guarda, mesmo quando também faz parte da
              equipe da escola. A escola não pode assinar no seu lugar.
            </p>
          </div>

          {familyPending.length > 0 ? (
            <p className="notice">
              {familyPending.length === 1
                ? "Um aluno seu tem pendência de consentimento. Sem o termo de matrícula, a vaga não é liberada."
                : `${familyPending.length} alunos seus têm pendência de consentimento. Sem o termo de matrícula, a vaga não é liberada.`}
            </p>
          ) : null}

          {family.map((student) => (
            <StudentCard key={student.studentId} student={student} readOnly={false} />
          ))}
        </section>
      ) : null}

      {signsTerms && family.length === 0 && !staffView ? (
        <p className="muted">
          Nenhum aluno vinculado ao seu login. Se isso estiver errado, fale com a secretaria
          da escola.
        </p>
      ) : null}

      {staffView ? (
        <section className="stack">
          {signsTerms ? (
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Pendências da escola
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Você vê estas pendências para cobrar as famílias, em modo leitura. Quem
                autoriza é o responsável, pelo login dele.
              </p>
            </div>
          ) : null}

          {othersPending.length === 0 ? (
            <p className="muted">
              Nenhuma pendência de consentimento. Todas as famílias autorizaram o termo
              obrigatório.
            </p>
          ) : (
            othersPending.map((student) => (
              <StudentCard key={student.studentId} student={student} readOnly />
            ))
          )}

          <p className="muted">
            <Link href="/alunos">← Voltar para alunos</Link>
          </p>
        </section>
      ) : null}
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
