import { competenceLabel, formatBRL, todayUtc } from "@nextgen/core";
import { expenseTotals, listExpenses } from "@/lib/billing";
import { competenceFrom, financeContext } from "@/lib/finance";
import { formatDate, isoDate } from "@/lib/format";
import { ExpenseForm } from "../forms";
import { PayExpenseButton } from "../invoice-actions";
import { CompetenceNav, FinanceDenied } from "../shared";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  campo: "Campo e aluguel",
  salario: "Salário e pró-labore",
  material: "Material esportivo",
  transporte: "Transporte",
  administrativo: "Administrativo",
  outros: "Outros",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const params = await searchParams;
  const competence = competenceFrom(params.mes);
  const expenses = await listExpenses(context.tenant, competence);
  const { total, paid } = expenseTotals(expenses);
  const today = isoDate(todayUtc());

  return (
    <>
      <div className="row">
        <div>
          <h2 className="section-title">Despesas de {competenceLabel(competence)}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {expenses.length} lançamento(s) · {formatBRL(total)} previsto · {formatBRL(paid)} pago ·{" "}
            {formatBRL(total - paid)} em aberto
          </p>
        </div>
        <CompetenceNav competence={competence} base="/financeiro/despesas" />
      </div>

      {context.canWrite ? (
        <section className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Lançar gasto</h3>
          <ExpenseForm today={today} />
        </section>
      ) : null}

      <section className="card">
        {expenses.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma despesa lançada nesta competência. Aluguel de campo, salário e material
            esportivo entram aqui para o saldo do mês fechar.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Fornecedor</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td data-label="Descrição">{expense.description}</td>
                    <td data-label="Categoria">{CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                    <td data-label="Fornecedor" className="muted">
                      {expense.supplier ?? "—"}
                    </td>
                    <td data-label="Vencimento">{formatDate(expense.dueDate)}</td>
                    <td data-label="Valor">{formatBRL(expense.amount)}</td>
                    <td data-label="Situação" className="cell-actions">
                      {expense.paidAt ? (
                        <span className="badge">Paga em {formatDate(expense.paidAt)}</span>
                      ) : context.canWrite ? (
                        <PayExpenseButton expenseId={expense.id} />
                      ) : (
                        <span className="badge warn">Em aberto</span>
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
