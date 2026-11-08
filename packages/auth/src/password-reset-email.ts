import { buildLinkEmail, escapeHtml, type EmailContent } from "./link-email";

export type { EmailContent } from "./link-email";

export type PasswordResetEmailInput = {
  /** Link de uso único gerado pelo Better Auth. */
  url: string;
  /** Destinatário, exibido no rodapé como prova de para quem o e-mail foi. */
  email: string;
  /** Origem pública do app, para os logos virarem URL absoluta. */
  appUrl: string;
  expiresInMinutes?: number;
};

/**
 * E-mail de senha. Serve tanto a "esqueci a senha" quanto ao primeiro acesso de quem
 * foi cadastrado pela escola e ainda não tem senha: o mesmo link cria a credencial.
 */
export function buildPasswordResetEmail({
  url,
  email,
  appUrl,
  expiresInMinutes = 30,
}: PasswordResetEmailInput): EmailContent {
  const safeEmail = escapeHtml(email);
  const validFor = `${expiresInMinutes} minutos`;

  return buildLinkEmail({
    url,
    email,
    appUrl,
    expiresInMinutes,
    copy: {
      subject: "Definir sua senha do NextGen",
      heading: "Definir sua senha",
      subheading: "Um clique e você escolhe a senha.",
      preview: `Link para definir uma nova senha, válido por ${validFor}.`,
      introHtml: `Recebemos um pedido de senha para <strong>${safeEmail}</strong>. Toque no
        botão para escolher a nova senha e entrar no painel.`,
      introText: `Recebemos um pedido de senha para ${email}.`,
      cta: "Definir senha",
      noticeHtml: `<strong>Se não foi você</strong>, ignore este e-mail. Sua senha continua
                    a mesma, e o link expira sozinho em ${validFor}.`,
      noticeText: "Se não foi você, ignore este e-mail. Sua senha continua a mesma.",
    },
  });
}
