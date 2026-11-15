"use client";

import { useActionState } from "react";
import { ROOM_KINDS } from "@/lib/unit-rules";
import { createRoom, type UnitState } from "./actions";

const initial: UnitState = { status: "idle" };

export function NewRoomForm({ unitId }: { unitId: string }) {
  const [state, action, pending] = useActionState(createRoom, initial);

  return (
    <form action={action}>
      <input type="hidden" name="unitId" value={unitId} />

      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor={`room-name-${unitId}`}>Nome da sala</label>
          <input
            id={`room-name-${unitId}`}
            name="name"
            required
            maxLength={60}
            placeholder="Campo 1"
          />
        </div>
        <div className="field">
          <label htmlFor={`room-kind-${unitId}`}>Tipo</label>
          <select id={`room-kind-${unitId}`} name="kind" defaultValue="field">
            {ROOM_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`room-capacity-${unitId}`}>Capacidade</label>
          <input
            id={`room-capacity-${unitId}`}
            name="capacity"
            type="number"
            min={1}
            max={200}
            defaultValue={20}
            required
          />
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        A vaga é limitada pela capacidade da turma. Aqui fica a referência do espaço — útil
        quando duas turmas dividem o mesmo campo.
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Salvando…" : "Adicionar sala"}
      </button>
    </form>
  );
}
