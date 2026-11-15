import Link from "next/link";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { ROOM_KIND_LABEL, listUnitsWithRooms } from "@/lib/units";
import { formatZip } from "@/lib/unit-rules";
import { NewRoomForm } from "./new-room-form";
import { NewUnitForm } from "./new-unit-form";

export const dynamic = "force-dynamic";

/**
 * Unidades e salas.
 *
 * É o primeiro cadastro de uma escola nova: a turma acontece em uma unidade, a unidade tem
 * salas, e é a sala que define onde o aluno treina e quantos cabem. Sem isso, o formulário
 * de turma fica sem chão — literalmente.
 */
export default async function UnitsPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  const canWrite = workspace.can("unit:write");
  const units = await listUnitsWithRooms({ schoolId: workspace.schoolId, userId: session.userId });

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Unidades e salas</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
            {units.length === 0
              ? `${workspace.schoolName} ainda não tem endereço cadastrado.`
              : `${units.length} unidade(s) em ${workspace.schoolName}.`}{" "}
            O responsável lê este endereço antes de matricular, e a turma escolhe a unidade e
            a sala onde treina.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/turmas">
          Ir para as turmas
        </Link>
      </div>

      {canWrite ? (
        <details className="panel" open={units.length === 0}>
          <summary>Cadastrar unidade</summary>
          <div className="panel-body">
            <NewUnitForm first={units.length === 0} />
          </div>
        </details>
      ) : (
        <p className="muted">Seu perfil enxerga as unidades em modo leitura.</p>
      )}

      {units.map((unit) => (
        <section key={unit.id} className="card">
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                {unit.name}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {unit.address} · {unit.city}/{unit.state} · CEP {formatZip(unit.zip)}
              </p>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              {unit.isPrimary ? <span className="badge">principal</span> : null}
              <span className="badge neutral">
                {unit.classGroups} turma(s) · {unit.rooms.length} sala(s)
              </span>
            </div>
          </div>

          <div className="table-scroll table-cards" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Sala</th>
                  <th>Tipo</th>
                  <th>Capacidade</th>
                  <th>Turmas</th>
                </tr>
              </thead>
              <tbody>
                {unit.rooms.map((room) => (
                  <tr key={room.id}>
                    <td data-label="Sala">
                      <strong>{room.name}</strong>
                    </td>
                    <td data-label="Tipo" className="muted">
                      {ROOM_KIND_LABEL[room.kind]}
                    </td>
                    <td data-label="Capacidade" className="muted">
                      {room.capacity} alunos
                    </td>
                    <td data-label="Turmas" className="muted">
                      {room.classGroups > 0 ? `${room.classGroups} turma(s)` : "livre"}
                    </td>
                  </tr>
                ))}
                {unit.rooms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Nenhuma sala. A turma pode acontecer na unidade sem sala definida — mas
                      com sala o sistema avisa quando dois treinos caem no mesmo espaço.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {canWrite ? (
            <details className="panel" style={{ marginTop: 14 }}>
              <summary>Adicionar sala em {unit.name}</summary>
              <div className="panel-body">
                <NewRoomForm unitId={unit.id} />
              </div>
            </details>
          ) : null}
        </section>
      ))}

      {units.length === 0 ? (
        <p className="notice">
          A ordem natural é: unidade → sala → turma → aluno. O aluno só entra numa turma, e a
          turma só existe com um endereço.
        </p>
      ) : null}
    </div>
  );
}
