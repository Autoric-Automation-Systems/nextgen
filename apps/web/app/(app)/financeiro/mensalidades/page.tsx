import Link from "next/link";
import { competenceLabel, formatBRL, pixPayload, todayUtc } from "@nextgen/core";
import { countBillableStudents, getPixSettings, listCompetenceInvoices } from "@/lib/billing";
import { competenceFrom, financeContext } from "@/lib/finance";
import { formatDate, isoDate } from "@/lib/format";
import { GenerateForm } from "../forms";
import { CopyButton, InvoiceActions, PaymentForm } from "../invoice-actions";
import { CompetenceNav, STATE_BADGE, STATE_LABEL, FinanceDenied } from "../shared";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const params = await searchParams;
  const competence = competenceFrom(params.mes);

  const [invoices, billable, pix] = await Promise.all([
    listCompetenceInvoices(context.tenant, competence),
    countBillableStudents(context.tenant),
    getPixSettings(context.tenant),
  ]);

  const today = isoDate(todayUtc());
  const pixReady = Boolean(pix.key);
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const received = invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0);

  return (
    <>
      <div className="row">
        <div>
          <h2 className="section-title">Mensalidades de {competenceLabel(competence)}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {invoices.length} cobrança(s) · {formatBRL(total)} cobrado · {formatBRL(received)} recebido
          </p>
        </div>
        <CompetenceNav competence={competence} base="/financeiro/mensalidades" />
      </div>

      {context.canWrite ? (
        <section className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Gerar a competência</h3>
          <GenerateForm competence={competence} billable={billable} />
        </section>
      ) : null}

      <section className="card">
        {invoices.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma cobrança nesta competência. Gere o mês acima — só entram alunos com plano e
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
                {invoices.map((invoice) => {
                  const outstanding = Math.max(0, invoice.amount - invoice.paidCents);
                  const pixCode =
                    pixReady && invoice.state !== "paga" && invoice.state !== "cancelada"
                      ? pixPayload({
                          key: pix.key!,
                          holder: pix.holder ?? context.workspace.schoolName,
                          city: pix.city ?? "Brasil",
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
                        {context.canWrite ? (
                          <div className="stack" style={{ gap: 8 }}>
                            {outstanding > 0 ? (
                              <PaymentForm invoiceId={invoice.id} outstanding={outstanding} today={today} />
                            ) : null}
                            {pixCode ? <CopyButton value={pixCode} /> : null}
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

      {!pixReady ? (
        <p className="muted" style={{ margin: 0 }}>
          Sem chave Pix, o botão de copiar não aparece e o e-mail não sai.{" "}
          <Link href="/financeiro/pix">Configurar chave Pix</Link>.
        </p>
      ) : null}
    </>
  );
}
