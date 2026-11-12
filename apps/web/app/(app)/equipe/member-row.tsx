"use client";

import { useActionState } from "react";
import { resendInvite, setMemberRole, setMemberStatus, type TeamState } from "./actions";
import { INVITABLE_ROLES, ROLE_LABELS } from "@/lib/team";
import type { TeamMemberRow } from "@/lib/team";

const initial: TeamState = { status: "idle" };

const STATUS_BADGE = {
  active: { text: "ativo", cls: "badge" },
  invited: { text: "convite pendente", cls: "badge warn" },
  revoked: { text: "acesso revogado", cls: "badge danger" },
} as const;

export function MemberRow({ member, isSelf }: { member: TeamMemberRow; isSelf: boolean }) {
  const [roleState, roleAction, savingRole] = useActionState(setMemberRole, initial);
  const [statusState, statusAction, savingStatus] = useActionState(setMemberStatus, initial);
  const [inviteState, inviteAction, sendingInvite] = useActionState(resendInvite, initial);

  const state = [roleState, statusState, inviteState].find((entry) => entry.status !== "idle");
  const badge = STATUS_BADGE[member.status];
  const suspended = member.status === "revoked";

  return (
    <div className="member-row">
      <div className="member-ident">
        <p className="consent-title">
          {member.name} <span className={badge.cls}>{badge.text}</span>
          {isSelf ? <span className="badge neutral">você</span> : null}
        </p>
        <p className="muted consent-desc">{member.email}</p>
        {member.role === "teacher" ? (
          <p className="muted consent-desc">
            {member.groups.length > 0 ? `Turmas: ${member.groups.join(", ")}` : "Sem turma vinculada"}
          </p>
        ) : null}
      </div>

      <div className="member-actions">
        <form action={roleAction} className="member-inline">
          <input type="hidden" name="userId" value={member.userId} />
          <label className="muted" htmlFor={`role-${member.userId}`} style={{ fontSize: 12 }}>
            Cargo
          </label>
          <select
            id={`role-${member.userId}`}
            name="role"
            defaultValue={member.role}
            disabled={isSelf || savingRole}
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-ghost" disabled={isSelf || savingRole}>
            {savingRole ? "Salvando…" : "Salvar"}
          </button>
        </form>

        <div className="member-inline">
          <form action={statusAction}>
            <input type="hidden" name="userId" value={member.userId} />
            {suspended ? null : <input type="hidden" name="suspend" value="on" />}
            <button type="submit" className="btn btn-ghost" disabled={isSelf || savingStatus}>
              {savingStatus ? "Salvando…" : suspended ? "Devolver acesso" : "Revogar acesso"}
            </button>
          </form>

          <form action={inviteAction}>
            <input type="hidden" name="userId" value={member.userId} />
            <input type="hidden" name="email" value={member.email} />
            <button type="submit" className="btn btn-ghost" disabled={sendingInvite}>
              {sendingInvite ? "Enviando…" : "Reenviar convite"}
            </button>
          </form>
        </div>
      </div>

      {state && state.status !== "idle" ? (
        <p className={state.status === "ok" ? "notice ok" : "notice error"} role="status" style={{ gridColumn: "1 / -1" }}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
