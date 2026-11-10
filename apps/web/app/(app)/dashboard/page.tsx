import Link from "next/link";
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
          <h2 className="section-title">Categorias</h2>
          <Link className="muted" href="/alunos">ver alunos →</Link>
        </div>
        {overview.categories.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nenhuma categoria criada para a temporada ativa.</p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Alunos matriculados</th>
                </tr>
              </thead>
              <tbody>
                {overview.categories.map((category) => (
                  <tr key={category.name}>
                    <td data-label="Categoria">{category.name}</td>
                    <td data-label="Alunos matriculados">{category.students}</td>
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
          habilidades, anamnese e o módulo financeiro com boleto.
        </p>
      </section>
    </div>
  );
}
