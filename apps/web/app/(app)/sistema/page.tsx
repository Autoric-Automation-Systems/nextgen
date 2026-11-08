import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { listVisibleSchools } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Diretório da plataforma.
 *
 * Só escola: nome, endereço e status. Aluno, financeiro e prontuário de cada escola
 * continuam fechados por tenant — abrir exige impersonação explícita e auditada, que é
 * outro fluxo. Um operador de SaaS não precisa do prontuário de uma criança para dar
 * suporte a um boleto.
 */
export default async function PlatformPage() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) redirect("/dashboard");

  const schools = await listVisibleSchools(session);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Escolas na plataforma</h1>
        <p className="muted" style={{ margin: 0 }}>
          {schools.length} escola(s). Você vê o diretório; os dados de aluno de cada uma continuam sob o vínculo
          dela.
        </p>
      </div>

      <section className="card card-flush">
        <table>
          <thead>
            <tr>
              <th>Escola</th>
              <th>Endereço público</th>
              <th>Seu acesso</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.id}>
                <td>
                  <strong>{school.name}</strong>
                </td>
                <td className="muted">/{school.slug}</td>
                <td>
                  {school.role ? (
                    <span className="badge">{school.role}</span>
                  ) : (
                    <span className="badge neutral">somente leitura</span>
                  )}
                </td>
              </tr>
            ))}
            {schools.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Nenhuma escola cadastrada. Crie a primeira ou rode o seed de demonstração.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          O que este painel não faz
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Não abre prontuário, anamnese nem financeiro de escola nenhuma. Entrar em uma escola para dar suporte é
          outro fluxo — impersonação com registro de quem entrou, quando e por quê.
        </p>
      </section>
    </div>
  );
}
