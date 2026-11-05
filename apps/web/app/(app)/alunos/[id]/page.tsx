import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/player-card";
import { requireSession } from "@/lib/session";
import { getStudentCard } from "@/lib/queries";
import { resolveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const CONSENT_LABEL = {
  granted: { text: "matrícula consentida", cls: "badge" },
  missing: { text: "consentimento pendente", cls: "badge warn" },
  revoked: { text: "consentimento revogado", cls: "badge danger" },
} as const;

const PUBLIC_CARD_REASON: Record<string, string> = {
  under_12: "menor de 12 anos não tem card público",
  not_opt_in: "a escola não optou por publicar",
  no_consent: "falta consentimento de imagem pública",
  revoked: "consentimento de imagem revogado",
};

export default async function StudentCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  const student = await getStudentCard({ schoolId: workspace.schoolId, userId: session.userId }, id);
  if (!student) notFound();

  const consent = CONSENT_LABEL[student.consent];

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <p className="muted" style={{ margin: "0 0 4px" }}>
            <Link href="/alunos">← Alunos</Link>
          </p>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>{student.fullName}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {student.category ?? "sem categoria"} · ciclo {student.cycleLabel} ·{" "}
            {student.guardianNames.join(", ") || "sem responsável vinculado"}
          </p>
        </div>
        <span className={consent.cls}>{consent.text}</span>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <PlayerCard
          data={{
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
          }}
        />

        <section className="card">
          <h2 className="section-title" style={{ marginBottom: 10 }}>
            O que o card mostra
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {student.age < 12
              ? "Aluno com menos de 12 anos: o card mostra barras por pilar e a categoria. Não existe nota geral nem atributo numérico — comparar crianças por número vira competição entre pais."
              : "Aluno com 12 anos ou mais: o card mostra a nota geral e as notas por atributo, com a variação desde o ciclo anterior."}
          </p>
          <p className="muted">
            Comportamental (disciplina, equipe, resiliência, foco) é interno: aparece para coordenação, professor e
            responsável, nunca no card público.
          </p>

          <h3 style={{ fontSize: 15, margin: "16px 0 6px" }}>Card público</h3>
          {student.publicCard.allowed ? (
            <p className="notice ok" style={{ margin: 0 }}>
              Publicado. O card público exibe apenas técnico, físico e tático, sem nome completo, sem idade e sem
              horário de treino.
            </p>
          ) : (
            <p className="notice" style={{ margin: 0 }}>
              Não publicado: {PUBLIC_CARD_REASON[student.publicCard.reason ?? ""] ?? "requisito não atendido"}.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
