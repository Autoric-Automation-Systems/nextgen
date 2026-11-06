import { redirect } from "next/navigation";
import { defaultBaseURL } from "@nextgen/auth/base-url";
import { buildMagicLinkEmail } from "@nextgen/auth";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Revisão do e-mail do link mágico, sem enviar e-mail.
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

  const { subject, text, html } = buildMagicLinkEmail({
    url: `${defaultBaseURL()}/api/auth/magic-link/verify?token=exemplo-nao-funciona&callbackURL=%2Fdashboard`,
    email: "responsavel@exemplo.com.br",
    appUrl: defaultBaseURL(),
    schoolName: "Escola Gol de Ouro",
  });

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>E-mail do link de acesso</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
          O mesmo componente que o login envia, com link de exemplo que não autentica ninguém.
          Confira em cliente real antes de anunciar: Gmail, Outlook e Apple Mail discordam
          sobre quase tudo, e é para eles que o e-mail é desenhado.
        </p>
      </div>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="badge">Assunto</span>
        <strong>{subject}</strong>
        <p className="muted" style={{ margin: 0 }}>
          Prévia ao lado do assunto: &ldquo;Seu link de uso único, válido por 15 minutos. Sem
          senha.&rdquo;
        </p>
      </section>

      <section className="card" style={{ padding: 12, overflow: "hidden" }}>
        <iframe
          title="Prévia do e-mail do link de acesso"
          srcDoc={html}
          style={{
            width: "100%",
            height: 1080,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "#f2f5f9",
          }}
        />
      </section>

      <section className="card">
        <h3>Versão em texto</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
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
          {text}
        </pre>
      </section>
    </div>
  );
}
