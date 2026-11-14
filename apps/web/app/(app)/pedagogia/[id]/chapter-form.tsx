"use client";

import { useActionState } from "react";
import { createChapter, type PedagogyState } from "../actions";

const initial: PedagogyState = { status: "idle" };

export function ChapterForm({ subjectId }: { subjectId: string }) {
  const [state, action, pending] = useActionState(createChapter, initial);

  return (
    <form action={action}>
      <input type="hidden" name="subjectId" value={subjectId} />

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="chapter-title">Título do capítulo</label>
          <input
            id="chapter-title"
            name="title"
            required
            maxLength={120}
            placeholder="Controle orientado"
          />
        </div>

        <div className="field">
          <label htmlFor="chapter-summary">Resumo (opcional)</label>
          <input
            id="chapter-summary"
            name="summary"
            maxLength={300}
            placeholder="Conduzir com as duas pernas, cabeça erguida"
          />
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar capítulo"}
      </button>
    </form>
  );
}
