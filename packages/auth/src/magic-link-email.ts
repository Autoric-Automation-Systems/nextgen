import { buildLinkEmail, escapeHtml, type EmailContent } from "./link-email";

export type { EmailContent } from "./link-email";

export type MagicLinkEmailInput = {
  /** Link de uso único gerado pelo Better Auth. */
  url: string;
  /** Destinatário, exibido no rodapé como prova de para quem o e-mail foi. */
  email: string;
  /** Origem pública do app, para os logos virarem URL absoluta. */
  appUrl: string;
  expiresInMinutes?: number;
  /** Nome da escola, quando o convite é de uma escola específica. */
  schoolName?: string | null;
};

/** Link que abre a conta. Serve ao cadastro e ao convite, não ao login do dia a dia. */
export function buildMagicLinkEmail({
  url,
  email,
  appUrl,
  expiresInMinutes = 15,
  schoolName,
}: MagicLinkEmailInput): EmailContent {
  const safeEmail = escapeHtml(email);
  const who = schoolName ? escapeHtml(schoolName) : null;
  const validFor = `${expiresInMinutes} minutos`;

  return buildLinkEmail({
    url,
    email,
    appUrl,
    expiresInMinutes,
    copy: {
      subject: "Seu link de acesso ao NextGen",
      heading: "Seu acesso está a um toque",
      subheading: "Link por e-mail. Sem senha para esquecer.",
      preview: `Seu link de uso único, válido por ${validFor}. Sem senha.`,
      introHtml: `${
        who
          ? `Você pediu para entrar no NextGen pela escola <strong>${who}</strong>.`
          : `Você pediu para entrar no NextGen com <strong>${safeEmail}</strong>.`
      } Toque no botão para abrir o painel.`,
      introText: who
        ? `Você pediu para entrar no NextGen pela escola ${schoolName}.`
        : `Você pediu para entrar no NextGen com ${email}.`,
      cta: "Entrar no NextGen",
      noticeHtml: `<strong>Se não foi você</strong>, ignore este e-mail. Sem esse clique ninguém
                    entra na conta, e o link expira sozinho em ${validFor}.`,
      noticeText: "Não foi você? Ignore este e-mail. Sem esse clique, ninguém entra na conta.",
    },
  });
}
