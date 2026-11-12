import Link from "next/link";
import { occupancyPercent } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { getOverview } from "@/lib/queries";
import { resolveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  const overview = await getOverview({ schoolId: workspace.schoolId, userId: session.userId });

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Olá, {session.name.split(" ")[0]}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {workspace.schoolName}. Todos os números abaixo vêm de consultas já filtradas por escola no banco.
        </p>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Alunos ativos</p>
          <div className="stat">{overview.students}</div>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Turmas ativas</p>
          <div className="stat">{overview.classGroups}</div>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Professores</p>
          <div className="stat">{overview.teachers}</div>
        </div>
      </div>

      {overview.pendingConsents > 0 ? (
        <div className="notice">
          <strong>{overview.pendingConsents} aluno(s) sem consentimento de matrícula.</strong> A matrícula
          fica em rascunho até o responsável assinar o termo — nenhum conteúdo fica disponível antes disso.
        </div>
      ) : (
        <div className="notice ok">Todos os alunos ativos têm consentimento de matrícula registrado.</div>
      )}

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section-title">Ocupação das turmas</h2>
          <Link className="muted" href="/turmas">ver turmas →</Link>
        </div>
        {overview.groups.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma turma aberta. Abra a primeira em Turmas — sem turma o aluno não tem horário.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Alunos</th>
                  <th>Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {overview.groups.map((group) => (
                  <tr key={group.id}>
                    <td data-label="Turma">
                      <Link href={`/turmas/${group.id}`}>{group.name}</Link>
                    </td>
                    <td data-label="Alunos" className="muted">
                      {group.students} de {group.capacity}
                    </td>
                    <td data-label="Ocupação">
                      <div className="meter" style={{ width: 120 }}>
                        <div
                          className={group.students >= group.capacity ? "meter-fill is-full" : "meter-fill"}
                          style={{ width: `${occupancyPercent(group.capacity, group.students)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 8 }}>Próximos passos da fundação</h2>
        <p className="muted" style={{ margin: 0 }}>
          Esta entrega cobre multitenancy com RLS, sessão, escopo de papel e as primitivas de
          consentimento. Ficam para as próximas fases: conteúdo e planos de aula, avaliação de
          habilidades, anamnese e a cobrança automática por PIX.
        </p>
      </section>
    </div>
  );
}
