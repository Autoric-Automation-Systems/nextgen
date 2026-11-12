import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { listClassGroups } from "@/lib/class-groups";
import { listTeam } from "@/lib/team";
import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  if (!workspace.can("teacher:manage")) {
    return <p className="muted">Só a administração da escola vê e edita a equipe.</p>;
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const [team, groups] = await Promise.all([listTeam(ctx), listClassGroups(ctx)]);

  const active = team.filter((member) => member.status === "active");
  const teachers = active.filter((member) => member.role === "teacher");

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Equipe</h1>
          <p className="muted" style={{ margin: 0 }}>
            Professores e coordenação entram por convite: a pessoa recebe um link no e-mail e define
            a própria senha. A escola nunca vê senha de ninguém.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="chip">
            <strong>{teachers.length}</strong> professores
          </span>
          <span className="chip">
            <strong>{active.length}</strong> com acesso
          </span>
        </div>
      </div>

      <details className="panel">
        <summary>Convidar pessoa para a equipe</summary>
        <InviteForm groups={groups.map((group) => ({ id: group.id, name: group.name }))} />
      </details>

      <section className="card">
        {team.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Ninguém na equipe ainda. Comece convidando um professor.
          </p>
        ) : (
          <div className="member-list">
            {team.map((member) => (
              <MemberRow key={member.membershipId} member={member} isSelf={member.userId === session.userId} />
            ))}
          </div>
        )}
      </section>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Revogar o acesso não apaga a pessoa: presenças, avaliações e aulas continuam ligadas a
        quem as registrou. O mesmo e-mail não pode ser responsável e equipe ao mesmo tempo, porque
        cada pessoa tem um cargo por escola.
      </p>
    </div>
  );
}
