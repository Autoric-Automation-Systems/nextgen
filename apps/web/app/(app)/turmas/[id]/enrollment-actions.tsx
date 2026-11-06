"use client";

import { useActionState } from "react";
import { activateWaitlist, endEnrollment, type TurmaState } from "../actions";

const initial: TurmaState = { status: "idle" };

type Props = {
  enrollmentId: string;
  classGroupId: string;
  kind: "roster" | "waitlist";
  disabledReason?: string;
};

/**
 * Duas ações por linha, cada uma com o próprio estado: encerrar matrícula e chamar da espera.
 * O erro fica na linha que o gerou — toast global esconde qual aluno falhou.
 */
export function EnrollmentActions({ enrollmentId, classGroupId, kind, disabledReason }: Props) {
  const [endState, endAction, endPending] = useActionState(endEnrollment, initial);
  const [waitState, waitAction, waitPending] = useActionState(activateWaitlist, initial);
  const message = endState.message ?? waitState.message;
  const isError = endState.status === "error" || waitState.status === "error";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      {kind === "roster" ? (
        <form action={endAction}>
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="classGroupId" value={classGroupId} />
          <button className="btn btn-ghost" style={{ height: 32, padding: "0 10px", fontSize: 13 }} disabled={endPending}>
            {endPending ? "Encerrando…" : "Encerrar"}
          </button>
        </form>
      ) : (
        <form action={waitAction}>
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="classGroupId" value={classGroupId} />
          <button
            className="btn"
            style={{ height: 32, padding: "0 10px", fontSize: 13 }}
            disabled={waitPending || Boolean(disabledReason)}
            title={disabledReason}
          >
            {waitPending ? "Chamando…" : "Chamar"}
          </button>
        </form>
      )}

      {message ? (
        <span className={isError ? "badge danger" : "badge"} style={{ maxWidth: 240, whiteSpace: "normal" }}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
