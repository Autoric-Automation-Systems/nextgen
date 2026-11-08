"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { BrandLogo } from "@/components/brand-logo";
import { loginErrorMessage } from "./error-message";

const initial: LoginState = { status: "idle" };

export function LoginForm({
  error,
  notice,
  next,
}: {
  error?: string;
  notice?: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState(signIn, initial);
  const reason = loginErrorMessage(error);

  return (
    <main>
      <div className="wrap auth-main">
        <div className="card auth-card">
          <div className="brand" style={{ marginBottom: 18 }}>
            <BrandLogo height={26} />
          </div>

          <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>Entrar</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            Use o e-mail e a senha que a escola cadastrou. Um acesso só serve a todos os
            perfis — responsável, professor, coordenação e administração.
          </p>

          {reason ? (
            <p className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {reason}
            </p>
          ) : null}

          {notice ? (
            <p className="notice ok" role="status" style={{ marginBottom: 16 }}>
              {notice}
            </p>
          ) : null}

          <form action={action}>
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={160}
                placeholder="voce@escola.com.br"
              />
            </div>

            <div className="field">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <label htmlFor="password">Senha</label>
                <Link href="/esqueci-senha" className="muted" style={{ fontWeight: 600 }}>
                  Esqueci minha senha
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="Sua senha"
              />
            </div>

            <label
              htmlFor="remember"
              className="muted"
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}
            >
              {/* Sem `checked`: o React não controla, e o navegador restaura o que o
                  usuário marcou da última vez. */}
              <input id="remember" name="remember" type="checkbox" defaultChecked />
              Manter conectado neste aparelho
            </label>

            {state.status === "error" ? (
              <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                {state.message}
              </p>
            ) : null}

            <button className="btn" style={{ width: "100%" }} disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "22px 0 18px" }} />

          <p className="muted" style={{ margin: 0 }}>
            Primeiro acesso ou convite da escola?{" "}
            <Link href="/cadastro" style={{ fontWeight: 600 }}>
              Receba o link por e-mail
            </Link>{" "}
            e defina sua senha.
          </p>

          <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
            Aluno menor de 16 anos não tem login próprio: o acesso é sempre do responsável
            legal, e o card do aluno é o que a escola publica — não uma conta da criança.
          </p>
        </div>
      </div>
    </main>
  );
}
