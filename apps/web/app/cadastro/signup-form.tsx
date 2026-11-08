"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestSignupLink, type SignupState } from "./actions";
import { BrandLogo } from "@/components/brand-logo";
import { loginErrorMessage } from "@/app/login/error-message";

const initial: SignupState = { status: "idle" };

export function SignupForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(requestSignupLink, initial);
  const reason = loginErrorMessage(error);

  return (
    <main>
      <div className="wrap auth-main">
        <div className="card auth-card">
          <div className="brand" style={{ marginBottom: 18 }}>
            <BrandLogo height={26} />
          </div>

          <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>
            Primeiro acesso
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            Informe o e-mail que a escola cadastrou. Enviamos um link para confirmar que ele
            é seu — e, ao abrir, você escolhe a senha. Depois disso o login é direto, sem
            e-mail a cada vez.
          </p>

          {reason ? (
            <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {reason}
            </p>
          ) : null}

          {state.status === "sent" ? (
            <div className="notice ok" role="status">
              Se este e-mail estiver liberado, o link chega em instantes. Ele vale por 15
              minutos, abre uma vez só e leva direto à definição da senha.
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
                {pending ? "Enviando…" : "Enviar link de cadastro"}
              </button>
            </form>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0 18px" }} />

          <p className="muted" style={{ margin: 0 }}>
            Já tem senha?{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>
              Entrar
            </Link>
            .
          </p>

          <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
            Ainda não tem escola no NextGen?{" "}
            <Link href="/escola" style={{ fontWeight: 600 }}>
              Peça o cadastro da escola
            </Link>
            . O acesso de aluno é sempre do responsável legal.
          </p>
        </div>
      </div>
    </main>
  );
}
