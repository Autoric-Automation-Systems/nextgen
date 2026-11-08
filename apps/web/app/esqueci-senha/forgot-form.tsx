"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { requestPasswordReset, type ForgotState } from "./actions";

const initial: ForgotState = { status: "idle" };

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  return (
    <main>
      <div className="wrap auth-main">
        <div className="card auth-card">
          <div className="brand" style={{ marginBottom: 18 }}>
            <BrandLogo height={26} />
          </div>

          <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>
            Esqueci minha senha
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            Informe seu e-mail. Mandamos um link para você definir uma senha nova — serve
            também para quem foi cadastrado pela escola e ainda não tem senha.
          </p>

          {state.status === "sent" ? (
            <div className="notice ok" role="status">
              Se este e-mail estiver cadastrado, o link chega em instantes. Ele vale por 30
              minutos e abre uma vez só.
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
                  maxLength={160}
                  placeholder="voce@escola.com.br"
                />
              </div>

              {state.status === "error" ? (
                <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                  {state.message}
                </p>
              ) : null}

              <button className="btn" style={{ width: "100%" }} disabled={pending}>
                {pending ? "Enviando…" : "Enviar link de senha"}
              </button>
            </form>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0 18px" }} />

          <p className="muted" style={{ margin: 0 }}>
            Lembrou a senha?{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>
              Entrar
            </Link>
            . Primeiro acesso?{" "}
            <Link href="/cadastro" style={{ fontWeight: 600 }}>
              Receba o link de cadastro
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
