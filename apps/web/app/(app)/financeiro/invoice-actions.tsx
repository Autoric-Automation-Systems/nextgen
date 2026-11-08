"use client";

import { useActionState, useState } from "react";
import { formatBRL } from "@nextgen/core";
import { cancelInvoice, emailInvoice, payExpense, registerPayment, type FinanceState } from "./actions";

const initial: FinanceState = { status: "idle" };

function Feedback({ state }: { state: FinanceState }) {
  if (state.status === "idle") return null;
  return (
    <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status" style={{ marginTop: 8 }}>
      {state.message}
    </p>
  );
}

export function CopyButton({ value, label = "Copiar Pix" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={copy}>
      {copied ? "Copiado" : label}
    </button>
  );
}

export function PaymentForm({
  invoiceId,
  outstanding,
  today,
}: {
  invoiceId: string;
  outstanding: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(registerPayment, initial);

  return (
    <details className="panel" style={{ marginTop: 8 }}>
      <summary>Registrar pagamento</summary>
      <div className="panel-body">
        <form action={action}>
          <Feedback state={state} />
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="field-row">
            <div className="field">
              <label>Valor recebido</label>
              <input
                name="amount"
                inputMode="decimal"
                placeholder={formatBRL(outstanding)}
                aria-label={`Valor recebido, saldo ${formatBRL(outstanding)}`}
              />
            </div>
            <div className="field">
              <label>Forma</label>
              <select name="method" defaultValue="pix">
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="card">Cartão</option>
                <option value="cash">Dinheiro</option>
                <option value="transfer">Transferência</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Data</label>
              <input name="paidAt" type="date" defaultValue={today} />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Deixe o valor em branco para quitar o saldo de {formatBRL(outstanding)}. Pagamento parcial
            mantém a cobrança aberta com o restante.
          </p>
          <button className="btn" disabled={pending}>
            {pending ? "Registrando…" : "Registrar"}
          </button>
        </form>
      </div>
    </details>
  );
}

export function InvoiceActions({ invoiceId, canEmail }: { invoiceId: string; canEmail: boolean }) {
  const [cancelState, cancelAction, cancelling] = useActionState(cancelInvoice, initial);
  const [emailState, emailAction, emailing] = useActionState(emailInvoice, initial);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="checks" style={{ gap: 8 }}>
        {canEmail ? (
          <form action={emailAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <button className="btn btn-ghost" disabled={emailing}>
              {emailing ? "Enviando…" : "Enviar por e-mail"}
            </button>
          </form>
        ) : null}
        <form action={cancelAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button className="btn btn-ghost" disabled={cancelling}>
            {cancelling ? "Cancelando…" : "Cancelar cobrança"}
          </button>
        </form>
      </div>
      <Feedback state={cancelState} />
      <Feedback state={emailState} />
    </div>
  );
}

export function PayExpenseButton({ expenseId }: { expenseId: string }) {
  const [state, action, pending] = useActionState(payExpense, initial);

  return (
    <form action={action}>
      <input type="hidden" name="expenseId" value={expenseId} />
      <button className="btn btn-ghost" disabled={pending}>
        {pending ? "Baixando…" : "Marcar como paga"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
