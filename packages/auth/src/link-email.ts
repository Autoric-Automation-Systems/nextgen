/**
 * Layout comum dos e-mails de link único (acesso e redefinição de senha).
 *
 * Regras que não são estética:
 * - **O link aparece duas vezes**: no botão e por extenso embaixo. Metade dos clientes
 *   corporativos abre o link em navegador interno, e o botão deixa de funcionar sem aviso;
 *   a versão por extenso é o plano B que sempre funciona.
 * - **Tabelas e estilo inline**. Gmail, Outlook e Apple Mail não concordam em quase nada;
 *   `flex`, `grid` e `<style>` no `<head>` são descartados por parte deles. Tabela com
 *   `role="presentation"` e `style` em cada célula é o único denominador comum.
 * - **Sem imagem como conteúdo**: se o cliente bloquear imagens (padrão no Outlook), o
 *   e-mail continua legível. Os logos são enfeite, e o `alt` cobre o resto.
 * - **Sem `background-image`/gradiente**: Outlook ignora e o texto branco fica em branco.
 * - **Texto também é enviado**: é o que leitores de tela, relógios e filtros antispam leem.
 *
 * A versão em texto não é um resumo — é o mesmo conteúdo, sem enfeite.
 */

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

const BRAND_GREEN = "#0b2416";
const ACCENT = "#c9f24d";
const INK = "#0b0f14";
const INK_SOFT = "#4a5568";
const LINE = "#e3e8ef";
const CANVAS = "#f2f5f9";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const AUTORIC_URL = "https://www.autoric.com.br";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Um link, dois textos. Tudo que difere entre "entrar" e "redefinir senha". */
export type LinkCopy = {
  subject: string;
  heading: string;
  subheading: string;
  preview: string;
  /** Frase que vem antes do botão, já escapada. */
  introHtml: string;
  introText: string;
  cta: string;
  /** Aviso "se não foi você", em HTML e em texto. */
  noticeHtml: string;
  noticeText: string;
};

export type LinkEmailInput = {
  /** Link de uso único gerado pelo Better Auth. */
  url: string;
  /** Destinatário, exibido no rodapé como prova de para quem o e-mail foi. */
  email: string;
  /** Origem pública do app, para os logos virarem URL absoluta. */
  appUrl: string;
  expiresInMinutes?: number;
  copy: LinkCopy;
};

export function buildLinkEmail({
  url,
  email,
  appUrl,
  expiresInMinutes = 15,
  copy,
}: LinkEmailInput): EmailContent {
  const origin = trimSlash(appUrl);
  const subject = copy.subject;
  const safeUrl = escapeHtml(url);
  const safeEmail = escapeHtml(email);
  const validFor = `${expiresInMinutes} minutos`;

  const text = [
    "NextGen — gestão de escolas de futebol",
    "",
    copy.heading,
    "",
    copy.introText,
    "",
    `Abra o link abaixo. Ele é de uso único e vale por ${validFor}:`,
    "",
    url,
    "",
    "Se o link não abrir, copie o endereço acima e cole na barra do navegador.",
    "",
    copy.noticeText,
    "",
    `Enviado para ${email}.`,
    `Desenvolvido por Autoric — ${AUTORIC_URL}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
<!-- Prévia: o trecho que o cliente mostra ao lado do assunto. Escondido no corpo. -->
<div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${copy.preview}
  &#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
  <tr>
    <td align="center" style="padding:32px 12px 40px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:18px;overflow:hidden;">

        <!-- Capa: a marca manda, sem enfeite que caia quando a imagem é bloqueada. -->
        <tr>
          <td align="center" style="background:${BRAND_GREEN};padding:36px 32px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:#ffffff;border-radius:18px;padding:10px;">
                  <img src="${origin}/brand/mark.png" width="44" height="32" alt="NextGen"
                       style="display:block;border:0;outline:none;text-decoration:none;width:44px;height:32px;">
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${ACCENT};">
              NextGen
            </p>
            <h1 style="margin:10px 0 0;font-family:${FONT};font-size:27px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">
              ${copy.heading}
            </h1>
            <p style="margin:10px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:rgba(255,255,255,0.72);">
              ${copy.subheading}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px;">
            <p style="margin:0 0 22px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK};">
              ${copy.introHtml}
            </p>

            <!-- Botão: célula com cor de fundo. O raio da borda é ignorado no Outlook
                 antigo (fica retangular), e é por isso que a versão por extenso existe. -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:4px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="${ACCENT}" style="border-radius:12px;padding:16px 34px;">
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                           style="display:inline-block;font-family:${FONT};font-size:16px;line-height:1;font-weight:700;letter-spacing:-0.01em;color:#08130c;text-decoration:none;">
                          ${copy.cta}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK_SOFT};">
              Válido por ${validFor} · uso único
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${INK_SOFT};">
              O botão não abriu? Copie o endereço abaixo e cole na barra do navegador.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:${CANVAS};border:1px solid ${LINE};border-radius:10px;padding:12px 14px;">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                     style="font-family:${MONO};font-size:12px;line-height:1.5;color:${INK_SOFT};text-decoration:none;word-break:break-all;">
                    ${safeUrl}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#fffaf0;border:1px solid #f5e3c0;border-radius:10px;padding:12px 14px;">
                  <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:#7c4a12;">
                    ${copy.noticeHtml}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 32px;">
            <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${INK_SOFT};">
              Enviado para <strong style="color:${INK};">${safeEmail}</strong>.
            </p>
          </td>
        </tr>
      </table>

      <!-- Rodapé: quem assina o produto, não o remetente. -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td align="center" style="padding:22px 12px 0;">
            <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.5;color:${INK_SOFT};">
              NextGen — gestão de escolas de futebol
            </p>
            <a href="${AUTORIC_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
              <img src="${origin}/dev/logo.png" width="108" height="31" alt="Autoric — Automation &amp; Systems"
                   style="display:block;border:0;outline:none;text-decoration:none;width:108px;height:31px;">
            </a>
            <p style="margin:10px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#98a2b3;">
              Desenvolvido por
              <a href="${AUTORIC_URL}" target="_blank" rel="noopener noreferrer" style="color:${INK_SOFT};text-decoration:underline;">Autoric</a>.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
