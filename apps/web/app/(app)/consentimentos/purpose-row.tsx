"use client";

import { useActionState } from "react";
import { grant, revoke, type ConsentFormState } from "./actions";
import type { PurposeView } from "@/lib/consent";

const initial: ConsentFormState = { status: "idle" };

export type PurposeRowProps = {
  studentId: string;
  purpose: PurposeView;
  label: { name: string; description: string; consequence: string };
  /** Abaixo de 12 anos o aceite precisa de destaque próprio (LGPD art. 14 §1º). */
  highlight: boolean;
  readOnly: boolean;
  /** Texto que explica por que o efeito da autorização não aparece hoje. */
  note?: string;
};

const BADGE = {
  granted: { text: "autorizado", cls: "badge" },
  revoked: { text: "revogado", cls: "badge danger" },
  missing: { text: "pendente", cls: "badge warn" },
} as const;

export function PurposeRow({ studentId, purpose, label, highlight, readOnly, note }: PurposeRowProps) {
  const [grantState, grantAction, granting] = useActionState(grant, initial);
  const [revokeState, revokeAction, revoking] = useActionState(revoke, initial);
  const state = revokeState.status !== "idle" ? revokeState : grantState;
  const badge = BADGE[purpose.status];
  const busy = granting || revoking;

  return (
    <div className={`consent-row${highlight && purpose.status !== "granted" ? " is-highlight" : ""}`}>
      <div className="consent-head">
        <div>
          <p className="consent-title">
            {label.name}{" "}
            <span className={badge.cls}>{badge.text}</span>
            {purpose.required ? <span className="badge neutral">obrigatório</span> : null}
            {purpose.sensitive ? <span className="badge neutral">dado sensível</span> : null}
          </p>
          <p className="muted consent-desc">{label.description}</p>
          {note ? <p className="consent-note">{note}</p> : null}
        </div>
      </div>

      {purpose.termBody ? (
        <details className="consent-term">
          <summary>
            Ler o termo {purpose.termVersion ? `v${purpose.termVersion}` : ""}
          </summary>
          <div className="consent-term-body">{purpose.termBody}</div>
        </details>
      ) : (
        <p className="notice">O termo desta finalidade ainda não foi publicado.</p>
      )}

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      {readOnly ? null : purpose.status === "granted" ? (
        <div className="consent-actions">
          <p className="muted consent-desc">{label.consequence}</p>
          <form action={revokeAction}>
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="purpose" value={purpose.code} />
            <button type="submit" className="btn btn-ghost" disabled={busy}>
              {revoking ? "Revogando…" : "Revogar"}
            </button>
          </form>
        </div>
      ) : (
        <form action={grantAction} className="consent-actions">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="purpose" value={purpose.code} />
          {purpose.termBody ? (
            <label className="consent-ack">
              <input type="checkbox" name="ack" required />
              Li o termo e autorizo o uso descrito acima.
            </label>
          ) : null}
          <button type="submit" className="btn" disabled={busy || !purpose.termBody}>
            {granting ? "Salvando…" : purpose.status === "revoked" ? "Autorizar de novo" : "Autorizar"}
          </button>
        </form>
      )}
    </div>
  );
}
