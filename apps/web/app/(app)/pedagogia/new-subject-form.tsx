"use client";

import { useActionState } from "react";
import { createSubject, type PedagogyState } from "./actions";

const initial: PedagogyState = { status: "idle" };

export function NewSubjectForm() {
  const [state, action, pending] = useActionState(createSubject, initial);

  return (
    <form action={action}>
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="subject-name">Nome da matéria</label>
          <input
            id="subject-name"
            name="name"
            required
            maxLength={60}
            placeholder="Fundamentos Técnicos"
          />
        </div>

        <div className="field">
          <label htmlFor="subject-description">Para que serve</label>
          <input
            id="subject-description"
            name="description"
            maxLength={300}
            placeholder="Base de passe, domínio e condução"
          />
        </div>
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar matéria"}
      </button>
    </form>
  );
}
