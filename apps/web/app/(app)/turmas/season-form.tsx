"use client";

import { useActionState } from "react";
import { createSeason, type TurmaState } from "./actions";

const initial: TurmaState = { status: "idle" };

export function SeasonForm({
  defaultName,
  defaultStartsOn,
  defaultEndsOn,
}: {
  defaultName: string;
  defaultStartsOn: string;
  defaultEndsOn: string;
}) {
  const [state, action, pending] = useActionState(createSeason, initial);

  return (
    <form action={action}>
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="season-name">Nome</label>
          <input id="season-name" name="name" required maxLength={40} defaultValue={defaultName} />
        </div>
        <div className="field">
          <label htmlFor="season-start">Início</label>
          <input id="season-start" name="startsOn" type="date" required defaultValue={defaultStartsOn} />
        </div>
        <div className="field">
          <label htmlFor="season-end">Fim</label>
          <input id="season-end" name="endsOn" type="date" required defaultValue={defaultEndsOn} />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        Uma temporada ativa por vez. As categorias e turmas pertencem a ela, então trocar de
        temporada arquiva o ano anterior sem apagar histórico.
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Criando…" : "Criar temporada"}
      </button>
    </form>
  );
}
