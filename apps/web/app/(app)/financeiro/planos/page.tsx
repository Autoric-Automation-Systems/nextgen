import { formatBRL } from "@nextgen/core";
import { listPlans } from "@/lib/billing";
import { financeContext } from "@/lib/finance";
import { FinanceDenied } from "../shared";
import { PlanForm } from "../forms";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const plans = await listPlans(context.tenant);

  return (
    <>
      <div>
        <h2 className="section-title">Planos de cobrança</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          O plano define valor mensal e dia de vencimento. O dia escolhido na matrícula do aluno
          vence o do plano.
        </p>
      </div>

      {context.canWrite ? (
        <section className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Novo plano</h3>
          <PlanForm />
        </section>
      ) : null}

      <section className="card">
        {plans.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum plano criado. Sem plano, a geração da competência não alcança nenhum aluno.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Valor mensal</th>
                  <th>Dia de vencimento</th>
                  <th>Alunos</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td data-label="Plano">
                      <strong>{plan.name}</strong>
                    </td>
                    <td data-label="Valor mensal">{formatBRL(plan.monthlyAmount)}</td>
                    <td data-label="Dia de vencimento">dia {plan.dueDay}</td>
                    <td data-label="Alunos">{plan.students}</td>
                    <td data-label="Situação">
                      {plan.active ? (
                        <span className="badge">Ativo</span>
                      ) : (
                        <span className="badge neutral">Inativo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
