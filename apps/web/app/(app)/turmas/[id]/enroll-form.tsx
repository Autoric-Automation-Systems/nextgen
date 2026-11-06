"use client";

import { useActionState } from "react";
import { enrollStudent, type TurmaState } from "../actions";

const initial: TurmaState = { status: "idle" };

export type Candidate = {
  id: string;
  name: string;
  birthYear: number;
  currentGroup: string | null;
  consent: "granted" | "missing" | "revoked";
  matchesCategory: boolean;
};

const CONSENT_NOTE: Record<Candidate["consent"], string> = {
  granted: "",
  missing: " · sem termo",
  revoked: " · termo revogado",
};

export function EnrollForm({ classGroupId, candidates }: { classGroupId: string; candidates: Candidate[] }) {
  const [state, action, pending] = useActionState(enrollStudent, initial);

  if (candidates.length === 0) {
    return (
      <p className="notice">
        Todos os alunos ativos já estão nesta turma. Cadastre o aluno em <strong>Alunos</strong> antes
        de matricular.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="classGroupId" value={classGroupId} />

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="enroll-student">Aluno</label>
        <select id="enroll-student" name="studentId" required defaultValue="">
          <option value="" disabled>
            Escolha o aluno…
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.birthYear}
              {candidate.currentGroup ? ` · hoje em ${candidate.currentGroup}` : ""}
              {CONSENT_NOTE[candidate.consent]}
              {candidate.matchesCategory ? "" : " · fora da categoria"}
            </option>
          ))}
        </select>
      </div>

      <details style={{ marginBottom: 14 }}>
        <summary className="muted" style={{ cursor: "pointer", marginBottom: 8 }}>
          Exceção: categoria ou segunda turma na temporada
        </summary>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="override-reason">Motivo (fica na auditoria)</label>
          <textarea
            id="override-reason"
            name="overrideReason"
            maxLength={280}
            placeholder="Atleta de 2009 autorizado pela coordenação a treinar com o Sub-13."
          />
        </div>
      </details>

      <button className="btn" disabled={pending}>
        {pending ? "Matriculando…" : "Matricular"}
      </button>
    </form>
  );
}
