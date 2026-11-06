"use client";

import { useActionState } from "react";
import { assignTeacher, removeTeacher, type TurmaState } from "../actions";

const initial: TurmaState = { status: "idle" };

export function TeacherPanel({
  classGroupId,
  teachers,
  options,
}: {
  classGroupId: string;
  teachers: { id: string; name: string }[];
  options: { id: string; name: string }[];
}) {
  const [assignState, assign, assigning] = useActionState(assignTeacher, initial);
  const [removeState, remove, removing] = useActionState(removeTeacher, initial);
  const message = assignState.message ?? removeState.message;
  const isError = assignState.status === "error" || removeState.status === "error";

  const available = options.filter((option) => !teachers.some((teacher) => teacher.id === option.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {message ? (
        <p className={isError ? "notice error" : "notice ok"} role="status">
          {message}
        </p>
      ) : null}

      {teachers.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Nenhum professor vinculado. Sem vínculo, a turma existe mas não aparece na agenda de
          ninguém — e a chamada não abre.
        </p>
      ) : (
        <div className="checks" style={{ gap: 8 }}>
          {teachers.map((teacher) => (
            <div key={teacher.id} className="chip">
              <strong>{teacher.name}</strong>
              <form action={remove}>
                <input type="hidden" name="classGroupId" value={classGroupId} />
                <input type="hidden" name="teacherId" value={teacher.id} />
                <button
                  className="btn btn-ghost"
                  style={{ height: 24, padding: "0 8px", fontSize: 12 }}
                  disabled={removing}
                  title={`Desvincular ${teacher.name}`}
                >
                  remover
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 ? (
        <form action={assign} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <input type="hidden" name="classGroupId" value={classGroupId} />
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label htmlFor="teacher-select">Vincular professor</label>
            <select id="teacher-select" name="teacherId" required defaultValue="">
              <option value="" disabled>
                Escolha…
              </option>
              {available.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <label className="check" style={{ paddingBottom: 12 }}>
            <input type="checkbox" name="isLead" />
            responsável pela turma
          </label>
          <button className="btn" style={{ marginBottom: 0 }} disabled={assigning}>
            {assigning ? "Vinculando…" : "Vincular"}
          </button>
        </form>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Todos os professores da escola já estão nesta turma. Cadastre outro em Professores.
        </p>
      )}
    </div>
  );
}
