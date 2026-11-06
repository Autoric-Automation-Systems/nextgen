"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { setupFirstSchool, type SetupState } from "./actions";

const initial: SetupState = { status: "idle" };

export function SetupForm() {
  const [state, action, pending] = useActionState(setupFirstSchool, initial);

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
            Esta instalação ainda não tem escola cadastrada. Ao criar, você vira o
            administrador e recebe o link de entrada no e-mail informado.
          </p>

          {state.status === "created" ? (
            <div className="notice ok" role="status">
              Escola criada. Enviamos o link de acesso para <strong>{state.email}</strong>. Ele
              vale por 15 minutos. Se não chegar,{" "}
              <Link href="/login">peça outro na tela de login</Link>.
            </div>
          ) : (
            <form action={action}>
              <div className="field">
                <label htmlFor="adminName">Seu nome</label>
                <input id="adminName" name="adminName" required maxLength={120} placeholder="Maria Souza" />
              </div>

              <div className="field">
                <label htmlFor="email">Seu e-mail</label>
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

              <div className="field">
                <label htmlFor="schoolName">Nome da escola</label>
                <input id="schoolName" name="schoolName" required maxLength={120} placeholder="Escola Gol de Ouro" />
              </div>

              <div className="field">
                <label htmlFor="schoolLegalName">Razão social (opcional)</label>
                <input
                  id="schoolLegalName"
                  name="schoolLegalName"
                  maxLength={160}
                  placeholder="Gol de Ouro Ltda"
                />
              </div>

              {state.status === "error" ? (
                <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
                  {state.message}
                </p>
              ) : null}

              <button className="btn" style={{ width: "100%" }} disabled={pending}>
                {pending ? "Criando…" : "Criar escola e receber link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
