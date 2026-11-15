import { redirect } from "next/navigation";
import { defaultBaseURL } from "@nextgen/auth/base-url";
import { buildInvitationEmail, buildPasswordResetEmail } from "@nextgen/auth";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Revisão dos e-mails de acesso, sem enviar e-mail.
 *
 * São dois, com o mesmo endpoint e momentos diferentes: convite (quem ainda não tem
 * senha) e redefinição (quem já tem). Ver os dois lado a lado é o que evita mandar
 * "você pediu uma senha" para uma família que nunca pediu nada.
 *
 * O e-mail é a única tela do produto que ninguém abre no navegador: se o botão fica torto
 * no Gmail, a descoberta acontece na caixa de entrada do cliente. Aqui o HTML renderiza no
 * mesmo motor do app, com dado de exemplo — mesmo padrão da revisão do card.
 *
 * `srcDoc` em vez de rota pública: o link de exemplo não pode virar login de verdade, e a
 * página não pode ser alcançada por quem não é da plataforma.
 */
export default async function EmailPreviewPage() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) redirect("/dashboard");

  const invitation = buildInvitationEmail({
    url: `${defaultBaseURL()}/api/auth/reset-password/exemplo-nao-funciona?callbackURL=%2Fredefinir-senha`,
    email: "responsavel@exemplo.com.br",
    appUrl: defaultBaseURL(),
    schoolName: "Escola Gol de Ouro",
  });

  const reset = buildPasswordResetEmail({
    url: `${defaultBaseURL()}/api/auth/reset-password/exemplo-nao-funciona?callbackURL=%2Fredefinir-senha`,
    email: "responsavel@exemplo.com.br",
    appUrl: defaultBaseURL(),
  });

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>E-mails de acesso</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
          O mesmo componente que o envio real usa, com link de exemplo que não autentica
          ninguém. O convite diz que foi a escola que cadastrou a pessoa; a redefinição só
          chega para quem já tem senha. Confira em cliente real antes de anunciar: Gmail,
          Outlook e Apple Mail discordam sobre quase tudo, e é para eles que o e-mail é
          desenhado.
        </p>
      </div>

      {[invitation, reset].map((email) => (
        <section key={email.subject} className="stack">
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="badge">Assunto</span>
            <strong>{email.subject}</strong>
          </div>

          <section className="card" style={{ padding: 12, overflow: "hidden" }}>
            <iframe
              title={`Prévia do e-mail: ${email.subject}`}
              srcDoc={email.html}
              style={{
                width: "100%",
                height: 1080,
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "#f2f5f9",
              }}
            />
          </section>

          <details className="panel">
            <summary>Versão em texto</summary>
            <div className="panel-body">
              <p className="muted" style={{ marginTop: 0 }}>
                Enviada junto do HTML. É o que leitor de tela, relógio e filtro antispam leem.
              </p>
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--canvas)",
                  border: "1px solid var(--line)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {email.text}
              </pre>
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
