"use client";

import { useActionState } from "react";
import { PasswordFields } from "@/components/password-fields";
import { setInitialPassword, type SetPasswordState } from "./actions";

const initial: SetPasswordState = { status: "idle" };

export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(setInitialPassword, initial);

  return (
    <main>
      <div className="wrap auth-main">
        <div className="card auth-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>
            Defina sua senha
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            E-mail confirmado: <strong>{email}</strong>. Escolha a senha que você vai usar
            para entrar a partir de agora.
          </p>

          <form action={action}>
            <PasswordFields autoFocus />

            {state.status === "error" ? (
              <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                {state.message}
              </p>
            ) : null}

            <button className="btn" style={{ width: "100%" }} disabled={pending}>
              {pending ? "Salvando…" : "Salvar senha e entrar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
