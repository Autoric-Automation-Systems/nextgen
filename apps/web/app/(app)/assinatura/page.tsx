import { SAAS_PLANS, formatBRL, planPriceCents, suggestedPlan } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { getSaasView } from "@/lib/saas";
import { formatDate } from "@/lib/format";
import { ChargeActions, PlanPicker } from "./forms";

export const dynamic = "force-dynamic";

const CHARGE_LABEL: Record<string, string> = {
  pending: "Em aberto",
  paid: "Paga",
  overdue: "Vencida",
  refunded: "Estornada",
  canceled: "Cancelada",
};

const STATUS_CLASS: Record<string, string> = {
  active: "badge",
  trialing: "badge neutral",
  past_due: "badge danger",
  canceled: "badge neutral",
};

/**
 * Assinatura da escola com a NextGen.
 *
 * Tela separada do financeiro de propósito: misturar a fatura da NextGen com a
 * mensalidade do aluno cria a dúvida "quem recebeu este dinheiro", que é justamente o
 * ponto regulatório que a arquitetura evita.
 */
export default async function SubscriptionPage() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);

  if (!workspace) {
    return <p className="muted">Sua conta não tem escola. Fale com a administração.</p>;
  }
  if (workspace.role !== "admin" || !workspace.can("school:write")) {
    return <p className="muted">A assinatura da escola é da administração.</p>;
  }

  const view = await getSaasView({ schoolId: workspace.schoolId, userId: session.userId });
  const suggested = suggestedPlan(view.activeStudents);

  const plans = SAAS_PLANS.map((plan) => ({
    code: plan.code,
    name: plan.name,
    range: plan.range,
    priceCents: planPriceCents(plan.code, view.activeStudents),
    recommended: plan.code === suggested.code,
  }));

  const trialOver = view.status === "past_due" || view.status === "canceled";

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 4px" }}>Assinatura NextGen</h1>
        <p className="muted" style={{ margin: 0 }}>
          {view.schoolName} — o que a escola paga pelo uso da plataforma. As mensalidades dos
          alunos são outras: caem na conta da escola, em{" "}
          <a href="/financeiro">Financeiro</a>.
        </p>
      </div>

      {!view.gatewayReady ? (
        <p className="notice error" role="status">
          Pagamento não configurado neste ambiente (falta <code>ASAAS_API_KEY</code>). Você pode
          ver o plano, mas não contratar nem pagar por aqui.
        </p>
      ) : null}

      {view.status === "trialing" && view.trialDaysLeft !== null ? (
        <p className="notice ok" role="status">
          Teste em andamento: {view.trialDaysLeft} dia(s) restantes
          {view.trialEndsAt ? `, até ${formatDate(view.trialEndsAt)}` : ""}.
          {trialOver ? " O acesso continua, mas a primeira fatura já venceu." : ""}
        </p>
      ) : null}

      {view.status === "past_due" ? (
        <p className="notice error" role="status">
          Pagamento em atraso. Regularize a fatura em aberto abaixo para não perder os recursos
          da escola.
        </p>
      ) : null}

      <section className="card">
        <div className="row">
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Plano atual
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              {view.plan ? `${view.plan.name} · ${view.plan.range}` : `Plano ${view.planCode}`} ·{" "}
              {view.activeStudents} aluno(s) ativo(s)
            </p>
          </div>
          <span className={STATUS_CLASS[view.status] ?? "badge neutral"}>{view.statusLabel}</span>
        </div>

        <div className="table-scroll table-cards" style={{ marginTop: 12 }}>
          <table>
            <tbody>
              <tr>
                <td data-label="Mensalidade">{formatBRL(view.priceCents)}</td>
                <td data-label="Base">{view.seats} aluno(s) na contratação</td>
                <td data-label="Próximo vencimento">
                  {view.nextDueDate ? formatDate(view.nextDueDate) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 4 }}>
          Faturas
        </h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          Emitidas pelo Asaas. O link abre o boleto, o Pix ou o cartão daquela fatura.
        </p>

        {view.charges.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma fatura por aqui ainda. Se você acabou de contratar, use “Sincronizar faturas”.
          </p>
        ) : (
          <div className="table-scroll table-cards">
            <table>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th>Pagar</th>
                </tr>
              </thead>
              <tbody>
                {view.charges.map((charge) => (
                  <tr key={charge.id}>
                    <td data-label="Vencimento">{formatDate(charge.dueDate)}</td>
                    <td data-label="Valor">{formatBRL(charge.amountCents)}</td>
                    <td data-label="Situação">
                      <span className={charge.status === "paid" ? "badge" : "badge neutral"}>
                        {CHARGE_LABEL[charge.status] ?? charge.status}
                      </span>
                    </td>
                    <td data-label="Pagar">
                      {charge.invoiceUrl ? (
                        <a href={charge.invoiceUrl} target="_blank" rel="noreferrer">
                          Abrir fatura
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <ChargeActions
            hasSubscription={Boolean(view.nextDueDate)}
            canCancel={view.status !== "canceled"}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: 4 }}>
          {view.status === "trialing" ? "Contratar agora" : "Trocar de plano"}
        </h2>
        <p className="muted" style={{ margin: "0 0 12px" }}>
          A cobrança é mensal no cartão, Pix ou boleto escolhido no Asaas. Trocar de plano cria
          uma assinatura nova; a anterior precisa ser cancelada aqui mesmo.
        </p>
        <PlanPicker plans={plans} current={view.planCode} />
      </section>
    </div>
  );
}
