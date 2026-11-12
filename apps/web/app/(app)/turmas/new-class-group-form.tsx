"use client";

import { useActionState } from "react";
import { WEEKDAYS } from "@nextgen/core";
import { createClassGroup, type TurmaState } from "./actions";

const initial: TurmaState = { status: "idle" };

export function NewClassGroupForm({
  units,
}: {
  units: { id: string; name: string; isPrimary: boolean }[];
}) {
  const [state, action, pending] = useActionState(createClassGroup, initial);

  return (
    <form action={action}>
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="group-name">Nome da turma</label>
          <input
            id="group-name"
            name="name"
            required
            maxLength={60}
            placeholder="Sub-9 — Ter/Qui 17h"
          />
        </div>

        <div className="field">
          <label htmlFor="group-unit">Unidade</label>
          <select
            id="group-unit"
            name="unitId"
            defaultValue={units.find((unit) => unit.isPrimary)?.id ?? units[0]?.id ?? ""}
          >
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="group-capacity">Capacidade</label>
          <input id="group-capacity" name="capacity" type="number" min={1} max={100} defaultValue={20} required />
        </div>
      </div>

      <div className="field">
        <label>Dias da semana</label>
        <div className="checks">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="check">
              <input type="checkbox" name="weekdays" value={day.value} />
              {day.short}
            </label>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="group-start">Início</label>
          <input id="group-start" name="startTime" type="time" required defaultValue="17:00" />
        </div>
        <div className="field">
          <label htmlFor="group-end">Fim</label>
          <input id="group-end" name="endTime" type="time" required defaultValue="18:00" />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        O nome é livre: &quot;Sub-9&quot;, &quot;Iniciantes&quot; ou &quot;Sub-11 feminino&quot;. O sistema recusa
        duas turmas na mesma sala no mesmo horário — é o erro que só aparece quando dois
        professores chegam juntos.
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Abrindo…" : "Abrir turma"}
      </button>
    </form>
  );
}
