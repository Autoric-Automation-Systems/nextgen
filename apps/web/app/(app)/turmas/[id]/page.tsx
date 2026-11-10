import Link from "next/link";
import { notFound } from "next/navigation";
import { ENROLLMENT_STATUS_LABEL } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { getClassGroup, listCandidateStudents, listTeacherOptions } from "@/lib/class-groups";
import { formatDate } from "@/lib/format";
import { EnrollForm } from "./enroll-form";
import { TeacherPanel } from "./teacher-panel";
import { EnrollmentActions } from "./enrollment-actions";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  active: "badge",
  draft: "badge warn",
  waitlist: "badge neutral",
};

const CONSENT_BADGE = {
  granted: { text: "termo ok", cls: "badge" },
  missing: { text: "sem termo", cls: "badge warn" },
  revoked: { text: "revogado", cls: "badge danger" },
} as const;

type ConsentKey = keyof typeof CONSENT_BADGE;

export default async function ClassGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
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
  const group = await getClassGroup(ctx, id, workspace.role === "teacher" ? { teacherId: session.userId } : {});
  if (!group) notFound();

  const canWrite = workspace.can("enrollment:write");
  const candidates = canWrite ? await listCandidateStudents(ctx, group.id) : [];
  const canManageTeachers = workspace.can("teacher:manage");
  const teacherOptions = canManageTeachers ? await listTeacherOptions(ctx) : [];
  const drafts = group.roster.filter((row) => row.status === "draft").length;

  return (
    <div className="stack">
      {aviso ? (
        <p className="notice ok" role="status">
          {aviso}
        </p>
      ) : null}

      <div>
        <p className="muted" style={{ margin: "0 0 4px" }}>
          <Link href="/turmas">← Turmas</Link>
        </p>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>{group.name}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {group.categoryName}
              {group.birthYearFrom !== null
                ? ` (nascidos em ${group.birthYearFrom === group.birthYearTo ? group.birthYearFrom : `${group.birthYearFrom}–${group.birthYearTo}`})`
                : ""}
              {" · "}
              {group.schedule}
              {" · "}
              {group.unitName}
              {group.roomName ? ` · ${group.roomName}` : ""}
              {" · temporada "}
              {group.seasonName}
            </p>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {group.teachers.length > 0
                ? `Professor(es): ${group.teachers.map((teacher) => teacher.name).join(", ")}`
                : "Sem professor vinculado"}
            </p>
          </div>
          {!group.isActive ? <span className="badge neutral">turma inativa</span> : null}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Matriculados</p>
          <div className="stat">
            {group.activeCount}
            <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> / {group.capacity}</span>
          </div>
          <div className="meter" style={{ marginTop: 10 }}>
            <div
              className={group.seats === 0 ? "meter-fill is-full" : "meter-fill"}
              style={{ width: `${group.occupancy}%` }}
            />
          </div>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {drafts > 0
              ? `${drafts} em rascunho — sem termo do responsável, não conta como vaga ocupada.`
              : "Só matrícula ativa ocupa vaga."}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Vagas livres</p>
          <div className="stat">{group.seats}</div>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {group.seats === 0
              ? "Turma cheia: quem entrar vai para a lista de espera."
              : "Com vaga e termo em dia, a matrícula entra como ativa."}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>Lista de espera</p>
          <div className="stat">{group.waitlistCount}</div>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Ordem de chegada. Chamar exige vaga e termo de matrícula em dia.
          </p>
        </div>
      </div>

      {canManageTeachers ? (
        <details className="panel" open={group.teachers.length === 0}>
          <summary>Professores da turma</summary>
          <div className="panel-body">
            <TeacherPanel classGroupId={group.id} teachers={group.teachers} options={teacherOptions} />
          </div>
        </details>
      ) : null}

      {canWrite ? (
        <details className="panel" open={group.activeCount === 0}>
          <summary>Matricular aluno</summary>
          <div className="panel-body">
            <EnrollForm classGroupId={group.id} candidates={candidates} />
          </div>
        </details>
      ) : null}

      <section className="card card-flush">
        <div className="row" style={{ padding: "16px 18px 0" }}>
          <h2 className="section-title">Turma</h2>
          <span className="muted">{group.roster.length} aluno(s) na lista</span>
        </div>
        <div className="table-scroll table-cards">
            <table>
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Nascimento</th>
              <th>Responsável</th>
              <th>Consentimento</th>
              <th>Situação</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {group.roster.map((row) => {
              const consent = CONSENT_BADGE[row.consent as ConsentKey];
              return (
                <tr key={row.id}>
                  <td data-label="Aluno">
                    <div className="cell-value">
                      <Link href={`/alunos/${row.studentId}`}>
                        <strong>{row.studentName}</strong>
                      </Link>
                      {row.nickname ? <span className="muted">{row.nickname}</span> : null}
                      {row.overrideReason ? <span className="muted">exceção: {row.overrideReason}</span> : null}
                    </div>
                  </td>
                  <td data-label="Nascimento" className="muted">{row.birthYear}</td>
                  <td data-label="Responsável" className="muted">{row.guardianNames.join(", ") || "—"}</td>
                  <td data-label="Consentimento">
                    <span className={consent.cls}>{consent.text}</span>
                  </td>
                  <td data-label="Situação">
                    <div className="cell-value">
                      <span className={STATUS_CLASS[row.status] ?? "badge neutral"}>
                        {ENROLLMENT_STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className="muted">desde {formatDate(row.startsOn)}</span>
                    </div>
                  </td>
                  <td className="cell-actions">
                    {canWrite ? (
                      <EnrollmentActions enrollmentId={row.id} classGroupId={group.id} kind="roster" />
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {group.roster.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum aluno matriculado. Use <strong>Matricular aluno</strong> acima: sem consentimento
                  a matrícula entra como rascunho e nada é liberado ao responsável antes do termo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
          </div>
      </section>

      {group.waitlist.length > 0 ? (
        <section className="card card-flush">
          <div className="row" style={{ padding: "16px 18px 0" }}>
            <h2 className="section-title">Lista de espera</h2>
            <span className="muted">ordem de chegada</span>
          </div>
          <div className="table-scroll table-cards">
            <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Aluno</th>
                <th>Responsável</th>
                <th>Consentimento</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {group.waitlist.map((row, index) => {
                const consent = CONSENT_BADGE[row.consent as ConsentKey];
                const blocked =
                  group.seats === 0
                    ? "Sem vaga nesta turma."
                    : row.consent === "revoked"
                      ? "Consentimento revogado: registre um novo termo."
                      : undefined;
                return (
                  <tr key={row.id}>
                    <td data-label="Posição" className="muted">{index + 1}</td>
                    <td data-label="Aluno">
                      <Link href={`/alunos/${row.studentId}`}>
                        <strong>{row.studentName}</strong>
                      </Link>
                    </td>
                    <td data-label="Responsável" className="muted">{row.guardianNames.join(", ") || "—"}</td>
                    <td data-label="Consentimento">
                      <span className={consent.cls}>{consent.text}</span>
                    </td>
                    <td className="cell-actions">
                      {canWrite ? (
                        <EnrollmentActions
                          enrollmentId={row.id}
                          classGroupId={group.id}
                          kind="waitlist"
                          disabledReason={blocked}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
