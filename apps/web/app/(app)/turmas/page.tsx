import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { getActiveSeason, listClassGroups, listUnits } from "@/lib/class-groups";
import { formatDate, isoDate, seasonYear } from "@/lib/format";
import { CategoryForm } from "./category-form";
import { NewClassGroupForm } from "./new-class-group-form";
import { SeasonForm } from "./season-form";

export const dynamic = "force-dynamic";

export default async function ClassGroupsPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  // A RLS isola a escola, não o papel: sem esta linha o responsável leria a turma inteira.
  if (workspace.role === "guardian") {
    return (
      <p className="muted">
        A lista de turmas é da equipe da escola. Seu acesso mostra os dados dos seus filhos em
        Alunos — fale com a secretaria se precisar de algo da turma.
      </p>
    );
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const teacherFilter = workspace.role === "teacher" ? { teacherId: session.userId } : {};
  const [season, groups, units] = await Promise.all([
    getActiveSeason(ctx),
    listClassGroups(ctx, teacherFilter),
    listUnits(ctx),
  ]);

  const canWrite = workspace.can("enrollment:write");
  const canManageStructure = workspace.can("school:write");
  const today = new Date();

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Turmas</h1>
        <p className="muted" style={{ margin: 0 }}>
          {season
            ? `Temporada ${season.name} · ${formatDate(season.startsOn)} a ${formatDate(season.endsOn)} · ${groups.length} turma(s)`
            : "Nenhuma temporada ativa. A turma pertence a uma temporada, então ela vem primeiro."}
        </p>
      </div>

      {!season ? (
        <section className="card">
          <h2 className="section-title" style={{ marginBottom: 8 }}>Abrir a primeira temporada</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            A temporada define o ano de referência das categorias (Sub-8 em 2026 são os nascidos em
            2018). Trocar de temporada no ano seguinte arquiva a anterior sem apagar matrícula.
          </p>
          {canManageStructure ? (
            <SeasonForm
              defaultName={String(seasonYear(today))}
              defaultStartsOn={isoDate(today)}
              defaultEndsOn={`${seasonYear(today)}-12-15`}
            />
          ) : (
            <p className="notice">Só a administração da escola cria a temporada.</p>
          )}
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 className="section-title">Categorias da temporada</h2>
              <span className="muted">{season.categories.length} categoria(s)</span>
            </div>

            {season.categories.length === 0 ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Nenhuma categoria ainda. Sub-8, Sub-9 e assim por diante — cada uma com a faixa de
                ano de nascimento que decide quem entra na turma.
              </p>
            ) : (
              <div className="checks" style={{ gap: 8 }}>
                {season.categories.map((category) => (
                  <span key={category.id} className="chip">
                    <strong>{category.name}</strong>
                    <span className="muted">
                      {category.birthYearFrom === null
                        ? "sem faixa"
                        : category.birthYearFrom === category.birthYearTo
                          ? `nascidos em ${category.birthYearFrom}`
                          : `${category.birthYearFrom}–${category.birthYearTo}`}
                      {" · "}
                      {category.students} aluno(s) · {category.classGroups} turma(s)
                    </span>
                  </span>
                ))}
              </div>
            )}

            {canManageStructure ? (
              <details className="panel" style={{ marginTop: 16 }}>
                <summary>Nova categoria</summary>
                <div className="panel-body">
                  <CategoryForm seasonId={season.id} seasonYear={seasonYear(season.startsOn)} />
                </div>
              </details>
            ) : null}
          </section>

          {canWrite ? (
            units.length === 0 ? (
              <p className="notice">
                Antes de abrir turma, cadastre uma unidade com endereço — a turma acontece em algum
                lugar, e o responsável precisa saber onde deixar o aluno.
              </p>
            ) : (
              <details className="panel">
                <summary>Abrir turma</summary>
                <div className="panel-body">
                  <NewClassGroupForm
                    seasonId={season.id}
                    categories={season.categories.map((category) => ({ id: category.id, name: category.name }))}
                    units={units}
                  />
                </div>
              </details>
            )
          ) : (
            <p className="muted">Seu perfil enxerga as turmas em modo leitura.</p>
          )}

          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Horário</th>
                  <th>Local</th>
                  <th>Professor(es)</th>
                  <th>Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <Link href={`/turmas/${group.id}`}>
                        <strong>{group.name}</strong>
                      </Link>
                      <div className="muted">{group.categoryName}</div>
                    </td>
                    <td>
                      {group.schedule}
                      {!group.isActive ? <span className="badge neutral" style={{ marginLeft: 8 }}>inativa</span> : null}
                    </td>
                    <td className="muted">
                      {group.unitName}
                      {group.roomName ? ` · ${group.roomName}` : ""}
                    </td>
                    <td className="muted">{group.teachers.join(", ") || "sem professor"}</td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>
                        <div className="meter" style={{ width: 90 }}>
                          <div
                            className={group.seats === 0 ? "meter-fill is-full" : "meter-fill"}
                            style={{ width: `${group.occupancy}%` }}
                          />
                        </div>
                        <span className="muted">
                          {group.activeCount}/{group.capacity}
                          {group.waitlistCount > 0 ? ` · ${group.waitlistCount} na espera` : ""}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Nenhuma turma nesta temporada. Abra a primeira acima — a lista de alunos
                      passa a mostrar categoria e turma de cada um.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </section>

          {canManageStructure ? (
            <details className="panel">
              <summary>Trocar de temporada</summary>
              <div className="panel-body">
                <p className="muted" style={{ marginTop: 0 }}>
                  A temporada atual ({season.name}) fica arquivada. Categorias, turmas e matrículas
                  continuam no histórico; só uma temporada fica ativa por vez.
                </p>
                <SeasonForm
                  defaultName={String(seasonYear(season.startsOn) + 1)}
                  defaultStartsOn={`${seasonYear(season.startsOn) + 1}-01-15`}
                  defaultEndsOn={`${seasonYear(season.startsOn) + 1}-12-15`}
                />
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
