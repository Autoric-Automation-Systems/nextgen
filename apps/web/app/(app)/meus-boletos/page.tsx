import Link from "next/link";
import { competenceLabel, formatBRL, pixPayload } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { getGuardianPix, listGuardianInvoices } from "@/lib/billing";
import { formatDate } from "@/lib/format";

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

export default async function MyInvoicesPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace) return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;

  if (session.actor.kind !== "guardian") {
    return (
      <p className="muted">
        Esta tela é o extrato do responsável. Para a escola, o financeiro fica em{" "}
        <Link href="/financeiro">Financeiro</Link>.
      </p>
    );
  }

  const ctx = { schoolId: workspace.schoolId, userId: session.userId };
  const [invoices, pix] = await Promise.all([
    listGuardianInvoices(ctx, session.actor.studentIds),
    getGuardianPix(ctx),
  ]);

  const open = invoices.filter((invoice) => invoice.state === "aberta" || invoice.state === "vencida");
  const totalOpen = open.reduce((total, invoice) => total + (invoice.amount - invoice.paidCents), 0);
  const overdue = open.filter((invoice) => invoice.state === "vencida");

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Mensalidades</h1>
        <p className="muted" style={{ margin: 0 }}>
          {open.length === 0
            ? "Nada em aberto no momento."
            : `${open.length} cobrança(s) em aberto · ${formatBRL(totalOpen)}${
                overdue.length > 0 ? ` · ${overdue.length} vencida(s)` : ""
              }`}
        </p>
      </div>

      {invoices.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma mensalidade emitida ainda. Quando a escola gerar a cobrança do mês, ela aparece
            aqui.
          </p>
        </section>
      ) : (
        <section className="card card-flush">
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Competência</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Aluno">{invoice.studentName}</td>
                    <td data-label="Competência">{competenceLabel(invoice.competence)}</td>
                    <td data-label="Vencimento">{formatDate(invoice.dueDate)}</td>
                    <td data-label="Valor">
                      <div className="cell-value">
                        {formatBRL(invoice.amount)}
                        {invoice.paidCents > 0 && invoice.paidCents < invoice.amount ? (
                          <span className="muted">resta {formatBRL(invoice.amount - invoice.paidCents)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Situação">
                      <span className={STATE_BADGE[invoice.state]}>{STATE_LABEL[invoice.state]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {open.length > 0 ? (
        <section className="card">
          <h2 className="section-title" style={{ marginBottom: 8 }}>
            Pagar por Pix
          </h2>
          {pix.key ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Copie o código da cobrança e cole no aplicativo do banco, em Pix → Pix copia e cola.
              </p>
              <div className="stack" style={{ gap: 12 }}>
                {open.map((invoice) => {
                  const payload = pixPayload({
                    key: pix.key!,
                    holder: pix.holder ?? workspace.schoolName,
                    city: pix.city ?? "Brasil",
                    amountCents: invoice.amount - invoice.paidCents,
                    txid: invoice.id,
                  }).payload;

                  return (
                    <div key={invoice.id} className="panel">
                      <div className="row" style={{ marginBottom: 6 }}>
                        <strong>
                          {invoice.studentName} · {competenceLabel(invoice.competence)}
                        </strong>
                        <span className="muted">
                          {formatBRL(invoice.amount - invoice.paidCents)} · vence{" "}
                          {formatDate(invoice.dueDate)}
                        </span>
                      </div>
                      <textarea readOnly value={payload} rows={3} aria-label="Código Pix copia e cola" />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              A escola ainda não cadastrou a chave Pix. Peça o boleto ou o link de pagamento na
              secretaria.
            </p>
          )}
        </section>
      ) : null}

      <p className="muted">
        Não reconhece uma cobrança? Fale com a secretaria de {workspace.schoolName} antes de pagar.
      </p>
    </div>
  );
}
