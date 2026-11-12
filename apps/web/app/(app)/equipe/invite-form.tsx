"use client";

import { useActionState, useState } from "react";
import { inviteMember, type TeamState } from "./actions";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/team";

const initial: TeamState = { status: "idle" };

export function InviteForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(inviteMember, initial);
  const [role, setRole] = useState<string>("teacher");

  return (
    <form action={action} className="panel-body stack">
      {state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status">
          {state.message}
        </p>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="member-name">Nome completo</label>
          <input id="member-name" name="name" required maxLength={120} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="member-email">E-mail</label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="professor@escola.com"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="member-role">Cargo</label>
        <select id="member-role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
          {INVITABLE_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
          {role === "admin"
            ? "Administração vê e altera tudo na escola, inclusive financeiro."
            : role === "coordinator"
              ? "Coordenação vê prontuário e avaliações, mas não mexe no financeiro."
              : "Professor vê as turmas dele: chamada, conteúdo e avaliação."}
        </p>
      </div>

      {role === "teacher" && groups.length > 0 ? (
        <fieldset className="field-group">
          <legend>Turmas deste professor (opcional)</legend>
          <div className="field-row" style={{ flexWrap: "wrap", gap: 12 }}>
            {groups.map((group) => (
              <label key={group.id} className="consent-ack">
                <input type="checkbox" name="classGroupIds" value={group.id} />
                {group.name}
              </label>
            ))}
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
            Dá para vincular depois pela própria turma.
          </p>
        </fieldset>
      ) : null}

      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Convidando…" : "Convidar e enviar acesso"}
        </button>
      </div>
    </form>
  );
}
