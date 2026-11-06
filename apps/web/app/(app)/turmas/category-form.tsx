"use client";

import { useActionState } from "react";
import { createCategory, type TurmaState } from "./actions";

const initial: TurmaState = { status: "idle" };

export function CategoryForm({ seasonId, seasonYear }: { seasonId: string; seasonYear: number }) {
  const [state, action, pending] = useActionState(createCategory, initial);

  return (
    <form action={action}>
      <input type="hidden" name="seasonId" value={seasonId} />

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="category-name">Categoria</label>
          <input
            id="category-name"
            name="name"
            required
            maxLength={40}
            placeholder="Sub-8"
            list="category-suggestions"
          />
          <datalist id="category-suggestions">
            {Array.from({ length: 10 }, (_, index) => `Sub-${index + 6}`).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="category-from">Nascidos de</label>
          <input id="category-from" name="birthYearFrom" type="number" min={1990} max={2100} placeholder={String(seasonYear - 8)} />
        </div>
        <div className="field">
          <label htmlFor="category-to">Nascidos até</label>
          <input id="category-to" name="birthYearTo" type="number" min={1990} max={2100} placeholder={String(seasonYear - 8)} />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        O nome preenche a faixa sozinho: <strong>Sub-8</strong> em {seasonYear} significa nascidos
        em {seasonYear - 8}. Deixar os anos em branco usa essa conta; preencher permite categoria
        com dois anos (Sub-11 = {seasonYear - 11} e {seasonYear - 10}).
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Criando…" : "Criar categoria"}
      </button>
    </form>
  );
}
