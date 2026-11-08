import { formatBRL, pixPayload, toCents } from "@nextgen/core";
import { getPixSettings } from "@/lib/billing";
import { financeContext } from "@/lib/finance";
import { FinanceDenied } from "../shared";
import { PixForm } from "../forms";
import { CopyButton } from "../invoice-actions";

export const dynamic = "force-dynamic";

export default async function PixPage() {
  const context = await financeContext();
  if (!context) return <FinanceDenied />;

  const pix = await getPixSettings(context.tenant);
  const ready = Boolean(pix.key);

  // Exemplo com valor fixo para a pessoa conferir a leitura no app do banco antes de cobrar.
  const sample = ready
    ? pixPayload({
        key: pix.key!,
        holder: pix.holder ?? context.workspace.schoolName,
        city: pix.city ?? "Brasil",
        amountCents: toCents("150,00"),
        txid: "EXEMPLO",
      })
    : null;

  return (
    <>
      <div>
        <h2 className="section-title">Cadastro Pix</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          A cobrança da NextGen é Pix copia e cola: o dinheiro cai direto na conta da escola, sem
          intermediação e sem taxa por boleto.
        </p>
      </div>

      {ready ? (
        <section className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Chave em uso</h3>
            <span className="badge">configurado</span>
          </div>
          <div className="table-scroll table-cards">
            <table>
              <tbody>
                <tr>
                  <td data-label="Chave">{pix.key}</td>
                  <td data-label="Titular">{pix.holder ?? "—"}</td>
                  <td data-label="Cidade">{pix.city ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {sample ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted" style={{ margin: "0 0 8px" }}>
                Teste de {formatBRL(toCents("150,00"))} — abra o app do banco, leia o código e
                confirme que o titular aparece certo antes de cobrar de verdade.
              </p>
              <CopyButton value={sample.payload} label="Copiar exemplo" />
            </div>
          ) : null}
        </section>
      ) : (
        <p className="notice warn" style={{ margin: 0 }}>
          Sem chave Pix a escola não consegue cobrar: as mensalidades são geradas, mas o responsável
          não recebe o código para pagar.
        </p>
      )}

      {context.canWrite ? (
        <section className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{ready ? "Trocar a chave" : "Cadastrar a chave"}</h3>
          <PixForm
            defaultKey={pix.key ?? ""}
            defaultHolder={pix.holder ?? ""}
            defaultCity={pix.city ?? ""}
          />
        </section>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Seu perfil enxerga a chave, mas não pode alterá-la.
        </p>
      )}
    </>
  );
}
