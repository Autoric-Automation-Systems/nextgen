"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestSchoolAccess, type LeadState } from "./actions";

const initial: LeadState = { status: "idle" };

export function LeadForm() {
  const [state, action, pending] = useActionState(requestSchoolAccess, initial);

  if (state.status === "sent") {
    return (
      <div className="notice ok" role="status">
        Pedido registrado. Vamos responder no e-mail informado em até um dia útil, com o
        convite para criar o acesso da escola.
      </div>
    );
  }

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="schoolName">Nome da escola</label>
        <input id="schoolName" name="schoolName" required maxLength={120} placeholder="Escola Gol de Ouro" />
      </div>

      <div className="field">
        <label htmlFor="contactName">Seu nome</label>
        <input id="contactName" name="contactName" required maxLength={120} placeholder="Maria Souza" />
      </div>

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

      <div className="field">
        <label htmlFor="phone">Telefone (opcional)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="(11) 99999-0000" />
      </div>

      <div className="field">
        <label htmlFor="city">Cidade (opcional)</label>
        <input id="city" name="city" maxLength={120} placeholder="São Paulo" />
      </div>

      <div className="field">
        <label htmlFor="studentCount">Quantos alunos (opcional)</label>
        <input id="studentCount" name="studentCount" type="number" min={1} max={100000} placeholder="80" />
      </div>

      <div className="field">
        <label htmlFor="message">O que você precisa resolver primeiro? (opcional)</label>
        <input id="message" name="message" maxLength={1000} placeholder="Mensalidades em planilha" />
      </div>

      {/* Armadilha para robô: escondido de pessoas, visível no HTML. */}
      <div aria-hidden className="hp-field">
        <label htmlFor="website">Site</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" ? (
        <p className="notice error" role="alert" style={{ marginBottom: 14 }}>
          {state.message}
        </p>
      ) : null}

      <button className="btn" style={{ width: "100%" }} disabled={pending}>
        {pending ? "Enviando…" : "Pedir cadastro"}
      </button>

      <p className="muted" style={{ marginTop: 14 }}>
        Já tem acesso?{" "}
        <Link href="/login" style={{ fontWeight: 600 }}>
          Entrar
        </Link>
        .
      </p>
    </form>
  );
}
