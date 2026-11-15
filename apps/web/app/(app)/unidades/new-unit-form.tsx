"use client";

import { useActionState } from "react";
import { UF_CODES } from "@/lib/unit-rules";
import { createUnit, type UnitState } from "./actions";

const initial: UnitState = { status: "idle" };

export function NewUnitForm({ first }: { first: boolean }) {
  const [state, action, pending] = useActionState(createUnit, initial);

  return (
    <form action={action}>
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="unit-name">Nome da unidade</label>
          <input id="unit-name" name="name" required maxLength={60} placeholder="Unidade Centro" />
        </div>
        <div className="field">
          <label htmlFor="unit-zip">CEP</label>
          <input
            id="unit-zip"
            name="zip"
            required
            inputMode="numeric"
            maxLength={9}
            placeholder="01310-100"
            autoComplete="postal-code"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="unit-address">Endereço</label>
        <input
          id="unit-address"
          name="address"
          required
          maxLength={160}
          placeholder="Rua Cardeal Arcoverde, 1200"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="unit-city">Cidade</label>
          <input id="unit-city" name="city" required maxLength={80} placeholder="São Paulo" />
        </div>
        <div className="field">
          <label htmlFor="unit-state">UF</label>
          <select id="unit-state" name="state" defaultValue="SP">
            {UF_CODES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {first
          ? "Esta vai nascer como unidade principal: é o endereço que aparece no convite da família e na página pública da escola."
          : "A unidade principal continua sendo a primeira cadastrada. O aluno pode treinar em qualquer uma."}
      </p>

      <button className="btn" disabled={pending}>
        {pending ? "Salvando…" : "Cadastrar unidade"}
      </button>
    </form>
  );
}
