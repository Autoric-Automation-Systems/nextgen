"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordFields } from "@/components/password-fields";
import { resetPassword, type ResetState } from "./actions";

const initial: ResetState = { status: "idle" };

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initial);

  return (
    <main>
      <div className="wrap auth-main">
        <div className="card auth-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>
            Nova senha
          </h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
            Escolha a senha nova. Por segurança, os outros aparelhos que estavam conectados
            vão precisar entrar de novo.
          </p>

          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <PasswordFields autoFocus />

            {state.status === "error" ? (
              <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                {state.message}
              </p>
            ) : null}

            <button className="btn" style={{ width: "100%" }} disabled={pending}>
              {pending ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 18, marginBottom: 0 }}>
            O link não funciona?{" "}
            <Link href="/esqueci-senha" style={{ fontWeight: 600 }}>
              Peça outro
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
