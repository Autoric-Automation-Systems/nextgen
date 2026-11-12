import Link from "next/link";
import {
  addCompetences,
  competenceLabel,
  formatBRL,
  isCompetence,
  pixPayload,
  todayUtc,
} from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { currentCompetence, getFinanceOverview } from "@/lib/billing";
import { formatDate, isoDate } from "@/lib/format";
import { ExpenseForm, GenerateForm, PixForm, PlanForm } from "./forms";
import { CopyButton, InvoiceActions, PaymentForm, PayExpenseButton } from "./invoice-actions";

export const dynamic = "force-dynamic";

const STATE_LABEL = {
  paga: "Paga",
  aberta: "Em aberto",
  vencida: "Vencida",
  cancelada: "Cancelada",
} as const;

const STATE_BADGE = {
  paga: "badge",
  aberta: "badge neutral",
  vencida: "badge danger",
  cancelada: "badge neutral",
} as const;

function CompetenceNav({ competence }: { competence: string }) {
  return (
    <div className="checks" style={{ gap: 8 }}>
      <Link className="btn btn-ghost" href={`/financeiro?mes=${addCompetences(competence, -1)}`}>
        ← {addCompetences(competence, -1)}
      </Link>
      <Link className="btn btn-ghost" href={`/financeiro?mes=${currentCompetence()}`}>
        Mês atual
      </Link>
      <Link className="btn btn-ghost" href={`/financeiro?mes=${addCompetences(competence, 1)}`}>
        {addCompetences(competence, 1)} →
      </Link>
    </div>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  // `charge:read` também vale para o responsável, mas só sobre as cobranças dos próprios
  // filhos; a visão da escola (totais, inadimplência, despesas) é da administração.
  if (!workspace.can("charge:read") || session.actor.kind === "guardian") {
    return (
      <p className="muted">
        O financeiro é da administração da escola. Suas mensalidades ficam em{" "}
        <Link href="/meus-boletos">Mensalidades</Link>.
      </p>
    );
  }

  const params = await searchParams;
  const competence = isCompetence(params.mes ?? "") ? params.mes! : currentCompetence();
  const overview = await getFinanceOverview(
    { schoolId: workspace.schoolId, userId: session.userId },
    competence,
  );

  const today = isoDate(todayUtc());
  const canWrite = workspace.can("charge:write") && !workspace.readOnly;
  const pixReady = Boolean(overview.pix.key);
  const balance = overview.summary.receivedCents - overview.expensePaidCents;

  return (
    <div className="stack">
      <div className="row">
        <div>
          <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Financeiro</h1>
          <p className="muted" style={{ margin: 0 }}>
            {competenceLabel(competence)} · {overview.summary.paidCount} paga(s),{" "}
            {overview.summary.overdueCount} vencida(s), {overview.summary.openCount} em aberto
          </p>
        </div>
        <CompetenceNav competence={competence} />
      </div>

      <section className="grid-cards">
        <div className="card">
          <p className="muted">Recebido no mês</p>
          <p className="stat">{formatBRL(overview.summary.receivedCents)}</p>
          <p className="muted">{overview.summary.paidCount} cobrança(s) quitada(s)</p>
        </div>
        <div className="card">
          <p className="muted">A receber</p>
          <p className="stat">{formatBRL(overview.summary.openCents)}</p>
          <p className="muted">{overview.summary.openCount} cobrança(s) com saldo</p>
        </div>
        <div className="card">
          <p className="muted">Vencido</p>
          <p className="stat" style={{ color: overview.summary.overdueCents > 0 ? "var(--danger)" : undefined }}>
            {formatBRL(overview.summary.overdueCents)}
          </p>
          <p className="muted">{overview.delinquents.length} aluno(s) inadimplente(s)</p>
        </div>
        <div className="card">
          <p className="muted">Despesas do mês</p>
          <p className="stat">{formatBRL(overview.expenseCents)}</p>
          <p className="muted">{formatBRL(overview.expensePaidCents)} já pagas</p>
        </div>
        <div className="card">
          <p className="muted">Saldo do mês</p>
          <p className="stat" style={{ color: balance < 0 ? "var(--danger)" : undefined }}>
            {formatBRL(balance)}
          </p>
          <p className="muted">Recebido menos despesas pagas</p>
        </div>
      </section>

      {overview.delinquents.length > 0 ? (
        <section className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 className="section-title">Inadimplentes</h2>
            <span className="muted">
              {formatBRL(overview.delinquents.reduce((total, entry) => total + entry.totalCents, 0))} em
              atraso
            </span>
          </div>
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Cobranças</th>
                  <th>Mais antiga</th>
                  <th>Atraso</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {overview.delinquents.map((entry) => (
                  <tr key={entry.studentId}>
                    <td data-label="Aluno">
                      <Link href={`/alunos/${entry.studentId}`}>{entry.studentName ?? "Aluno"}</Link>
                    </td>
                    <td data-label="Cobranças">{entry.charges}</td>
                    <td data-label="Mais antiga">{formatDate(entry.oldestDueDate)}</td>
                    <td data-label="Atraso">{entry.daysLate} dia(s)</td>
                    <td data-label="Total">
                      <strong>{formatBRL(entry.totalCents)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section-title">Mensalidades de {competenceLabel(competence)}</h2>
          <span className="muted">{overview.invoices.length} cobrança(s)</span>
        </div>

        {overview.invoices.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Nenhuma cobrança nesta competência. A cobrança automática gera sozinha quando o
            vencimento chega; para antecipar, gere o mês abaixo — só entram alunos com plano e
            matrícula ativa.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Recebido</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {overview.invoices.map((invoice) => {
                  const outstanding = Math.max(0, invoice.amount - invoice.paidCents);
                  const pix =
                    pixReady && invoice.state !== "paga" && invoice.state !== "cancelada"
                      ? pixPayload({
                          key: overview.pix.key!,
                          holder: overview.pix.holder ?? workspace.schoolName,
                          city: overview.pix.city ?? "Brasil",
                          amountCents: invoice.amount,
                          txid: invoice.id,
                        }).payload
                      : null;

                  return (
                    <tr key={invoice.id}>
                      <td data-label="Aluno">
                        <div className="cell-value">
                          <Link href={`/alunos/${invoice.studentId}`}>{invoice.studentName}</Link>
                          {invoice.discount > 0 ? (
                            <span className="muted">
                              {formatBRL(invoice.baseAmount)} − {formatBRL(invoice.discount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Vencimento">{formatDate(invoice.dueDate)}</td>
                      <td data-label="Valor">{formatBRL(invoice.amount)}</td>
                      <td data-label="Recebido">{invoice.paidCents > 0 ? formatBRL(invoice.paidCents) : "—"}</td>
                      <td data-label="Situação">
                        <span className={STATE_BADGE[invoice.state]}>{STATE_LABEL[invoice.state]}</span>
                      </td>
                      <td className="cell-actions">
                        {canWrite ? (
                          <div className="stack" style={{ gap: 8 }}>
                            {outstanding > 0 ? (
                              <PaymentForm invoiceId={invoice.id} outstanding={outstanding} today={today} />
                            ) : null}
                            {pix ? <CopyButton value={pix} /> : null}
                            {invoice.state !== "paga" && invoice.state !== "cancelada" ? (
                              <InvoiceActions invoiceId={invoice.id} canEmail={pixReady} />
                            ) : null}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canWrite ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <section className="card">
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              Gerar a competência
            </h2>
            <GenerateForm competence={competence} billable={overview.billableStudents} />
          </section>

          <section className="card">
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              Planos de cobrança
            </h2>
            {overview.plans.length > 0 ? (
              <div className="checks" style={{ gap: 8, marginBottom: 12 }}>
                {overview.plans.map((plan) => (
                  <span key={plan.id} className="chip">
                    <strong>{plan.name}</strong>
                    <span className="muted">
                      {formatBRL(plan.monthlyAmount)} · {plan.students} aluno(s)
                      {plan.active ? "" : " · inativo"}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                Nenhum plano ainda. Sem plano não há valor para cobrar.
              </p>
            )}
            <details className="panel">
              <summary>Novo plano</summary>
              <div className="panel-body">
                <PlanForm />
              </div>
            </details>
          </section>

          <section className="card">
            <h2 className="section-title" style={{ marginBottom: 8 }}>
              Recebimento por Pix
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {pixReady
                ? "Chave configurada: o copia e cola de cada mensalidade já sai com valor e identificador."
                : "Sem chave Pix o responsável não recebe o copia e cola; a cobrança fica só na tela."}
            </p>
            <details className="panel" open={!pixReady}>
              <summary>{pixReady ? "Alterar chave" : "Configurar chave"}</summary>
              <div className="panel-body">
                <PixForm
                  defaultKey={overview.pix.key ?? ""}
                  defaultHolder={overview.pix.holder ?? workspace.schoolName}
                  defaultCity={overview.pix.city ?? ""}
                />
              </div>
            </details>
          </section>
        </div>
      ) : null}

      <section className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section-title">Despesas de {competenceLabel(competence)}</h2>
          <span className="muted">{formatBRL(overview.expenseCents)}</span>
        </div>

        {overview.expenses.length === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Nenhuma despesa lançada neste mês.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {overview.expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td data-label="Descrição">
                      <div className="cell-value">
                        {expense.description}
                        {expense.supplier ? <span className="muted">{expense.supplier}</span> : null}
                      </div>
                    </td>
                    <td data-label="Categoria">{expense.category}</td>
                    <td data-label="Vencimento">{formatDate(expense.dueDate)}</td>
                    <td data-label="Valor">{formatBRL(expense.amount)}</td>
                    <td data-label="Situação" className="cell-actions">
                      {expense.paidAt ? (
                        <span className="badge">Paga</span>
                      ) : canWrite ? (
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

        {canWrite ? (
          <details className="panel" style={{ marginTop: 16 }}>
            <summary>Lançar despesa</summary>
            <div className="panel-body">
              <ExpenseForm today={today} />
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
