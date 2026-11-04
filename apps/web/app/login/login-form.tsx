"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "./actions";
import { BrandLogo } from "@/components/brand-logo";
import { loginErrorMessage } from "./error-message";

const initial: LoginState = { status: "idle" };

export function LoginForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);
  const reason = loginErrorMessage(error);

  return (
    <main className="wrap">
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <BrandLogo height={26} />
        </div>

        <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>Entrar no painel</h2>
        <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
          Enviamos um link de acesso para o seu e-mail. Sem senha para vazar.
        </p>

        {reason ? (
          <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
            {reason}
          </p>
        ) : null}

        {state.status === "sent" ? (
          <div className="notice ok" role="status">
            Se este e-mail estiver cadastrado, o link chega em instantes. Ele vale por 15 minutos e
            só pode ser usado uma vez.
          </div>
        ) : (
          <form action={action}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@escola.com.br"
              />
            </div>
            {state.status === "error" ? (
              <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                {state.message}
              </p>
            ) : null}
            <button className="btn" style={{ width: "100%" }} disabled={pending}>
              {pending ? "Enviando…" : "Enviar link de acesso"}
            </button>
          </form>
        )}

        <p className="muted" style={{ marginTop: 20 }}>
          Aluno menor de 16 anos não tem login próprio: o acesso é sempre do responsável legal.
        </p>
      </div>
    </main>
  );
}
