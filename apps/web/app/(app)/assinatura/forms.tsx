"use client";

import { useActionState } from "react";
import { formatBRL } from "@nextgen/core";
import {
  cancelSaasSubscription,
  subscribeSchool,
  syncSaasCharges,
  type SaasState,
} from "./actions";

const initial: SaasState = { status: "idle" };

function Feedback({ state }: { state: SaasState }) {
  if (state.status === "idle") return null;
  return (
    <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
      {state.message}
    </p>
  );
}

export type PlanOption = {
  code: string;
  name: string;
  range: string;
  priceCents: number;
  recommended: boolean;
};

export function PlanPicker({ plans, current }: { plans: PlanOption[]; current: string }) {
  const [state, action, pending] = useActionState(subscribeSchool, initial);

  return (
    <form action={action}>
      <Feedback state={state} />

      <div className="checks" style={{ marginBottom: 14 }}>
        {plans.map((plan) => (
          <label key={plan.code} className="check" style={{ alignItems: "flex-start", gap: 8 }}>
            <input
              type="radio"
              name="planCode"
              value={plan.code}
              defaultChecked={plan.code === current}
              required
            />
            <span>
              <strong>{plan.name}</strong>
              {plan.recommended ? <span className="badge" style={{ marginLeft: 6 }}>sugerido</span> : null}
              <span className="muted" style={{ display: "block", fontSize: 12 }}>
                {plan.range} · {formatBRL(plan.priceCents)}/mês
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="field" style={{ maxWidth: 280 }}>
        <label htmlFor="cpf-cnpj">CPF ou CNPJ do responsável</label>
        <input
          id="cpf-cnpj"
          name="cpfCnpj"
          required
          inputMode="numeric"
          placeholder="Somente números"
          autoComplete="off"
        />
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          Vai só para o Asaas emitir a cobrança. A NextGen não guarda o documento: no cadastro
          fica apenas o hash e os quatro últimos dígitos.
        </p>
      </div>

      <button className="btn" disabled={pending}>
        {pending ? "Falando com o Asaas…" : "Contratar plano"}
      </button>
    </form>
  );
}

export function ChargeActions({
  hasSubscription,
  canCancel,
}: {
  hasSubscription: boolean;
  canCancel: boolean;
}) {
  const [syncState, syncAction, syncing] = useActionState(syncSaasCharges, initial);
  const [cancelState, cancelAction, canceling] = useActionState(cancelSaasSubscription, initial);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Feedback state={syncState} />
      <Feedback state={cancelState} />
      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <form action={syncAction}>
          <button className="btn secondary" disabled={syncing || !hasSubscription}>
            {syncing ? "Consultando…" : "Sincronizar faturas"}
          </button>
        </form>
        {canCancel ? (
          <form action={cancelAction}>
            <button className="btn secondary" disabled={canceling || !hasSubscription}>
              {canceling ? "Cancelando…" : "Cancelar assinatura"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
