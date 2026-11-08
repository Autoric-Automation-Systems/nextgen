import {
  competenceLabel,
  deliveryDateFor,
  deliveryHint,
  describeDelivery,
  formatBRL,
} from "@nextgen/core";
import { listCompetenceInvoices } from "@/lib/billing";
import { getDeliverySettings } from "@/lib/delivery";
import { competenceFrom, financeContext } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { DeliveryForm } from "../forms";
import { FinanceDenied } from "../shared";

export const dynamic = "force-dynamic";

/**
 * Configuração do envio da mensalidade.
 *
 * Fica no financeiro, e não nas configurações da escola, porque a decisão é de dinheiro:
 * quem mexe em valor e vencimento decide quando o responsável recebe o código. O botão
 * manual continua em Mensalidades, cobrança por cobrança.
 */
export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const params = await searchParams;
  const competence = competenceFrom(params.mes);

  const [settings, invoices] = await Promise.all([
    getDeliverySettings(context.tenant),
    listCompetenceInvoices(context.tenant, competence),
  ]);

  const sentThisMonth = invoices.filter((invoice) => invoice.lastSentAt !== null);
  const pending = invoices.filter(
    (invoice) => invoice.lastSentAt === null && invoice.state === "aberta",
  );
  const scheduled = deliveryDateFor(competence, settings.sendDay);
  const hint = deliveryHint(settings, 10);
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <>
      <div>
        <h2 className="section-title">Envio da cobrança</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          O e-mail com o Pix da escola e a data de vencimento, para o responsável financeiro.
          Nenhum gateway no meio: o código sai da chave cadastrada em{" "}
          <a href="/financeiro/pix">Pix</a>.
        </p>
      </div>

      <section className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Como o envio funciona hoje</h3>
        <p style={{ margin: "0 0 12px" }}>
          <strong>{describeDelivery(settings)}</strong>
          {settings.automatic ? (
            <>
              . Em {competenceLabel(competence)} o próximo envio sai em {formatDate(scheduled)}.
            </>
          ) : (
            <> — a cobrança sai pelo botão “Enviar” em Mensalidades.</>
          )}
        </p>

        {hint ? (
          <p className="notice" role="status" style={{ margin: "0 0 12px" }}>
            {hint}
          </p>
        ) : null}

        {context.canWrite ? (
          <DeliveryForm automatic={settings.automatic} sendDay={settings.sendDay} dueDay={10} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Somente leitura: seu perfil vê a configuração, mas não altera o envio.
          </p>
        )}
      </section>

      <section className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
          {competenceLabel(competence)} até agora
        </h3>
        <div className="table-scroll table-cards">
          <table>
            <tbody>
              <tr>
                <td data-label="Situação">Cobranças emitidas</td>
                <td data-label="Total">{invoices.length}</td>
              </tr>
              <tr>
                <td data-label="Situação">Enviadas ao responsável</td>
                <td data-label="Total">{sentThisMonth.length}</td>
              </tr>
              <tr>
                <td data-label="Situação">Aguardando envio manual</td>
                <td data-label="Total">{pending.length}</td>
              </tr>
              <tr>
                <td data-label="Situação">Em aberto no mês</td>
                <td data-label="Total">
                  {formatBRL(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ margin: "12px 0 0" }}>
          O envio automático sai uma vez por cobrança por mês. Reenviar é sempre um clique em
          Mensalidades — mudar o dia no meio do mês não dispara um segundo e-mail sozinho.
        </p>
      </section>
    </>
  );
}
