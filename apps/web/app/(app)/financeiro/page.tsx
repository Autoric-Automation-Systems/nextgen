import Link from "next/link";
import { competenceLabel, formatBRL } from "@nextgen/core";
import { getFinanceOverview } from "@/lib/billing";
import { competenceFrom, financeContext } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { CompetenceNav, FinanceDenied } from "./shared";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const params = await searchParams;
  const competence = competenceFrom(params.mes);
  const overview = await getFinanceOverview(context.tenant, competence);

  const balance = overview.summary.receivedCents - overview.expensePaidCents;
  const openCents = overview.summary.openCents + overview.summary.overdueCents;
  const pixReady = Boolean(overview.pix.key);

  return (
    <>
      <div className="row">
        <div>
          <h2 className="section-title">{competenceLabel(competence)}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {overview.summary.paidCount} paga(s), {overview.summary.overdueCount} vencida(s),{" "}
            {overview.summary.openCount} em aberto
          </p>
        </div>
        <CompetenceNav competence={competence} base="/financeiro" />
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
          <p
            className="stat"
            style={{ color: overview.summary.overdueCents > 0 ? "var(--danger)" : undefined }}
          >
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

      <section className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <h2 className="section-title">Inadimplentes</h2>
          <span className="muted">
            {formatBRL(overview.delinquents.reduce((total, entry) => total + entry.totalCents, 0))} em
            atraso
          </span>
        </div>
        {overview.delinquents.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum aluno inadimplente nesta competência.
          </p>
        ) : (
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
        )}
      </section>

      <p className="muted" style={{ margin: 0 }}>
        {openCents > 0
          ? `${formatBRL(openCents)} ainda em aberto nesta competência.`
          : "Nada em aberto nesta competência."}{" "}
        {pixReady
          ? ""
          : "A escola ainda não tem chave Pix: as cobranças existem, mas o responsável não recebe o copia e cola — configure em Pix."}
      </p>
    </>
  );
}
