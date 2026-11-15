import { buildLinkEmail, escapeHtml, type EmailContent } from "./link-email";

export type { EmailContent } from "./link-email";

export type InvitationEmailInput = {
  /** Link de uso único gerado pelo Better Auth, que leva a `/redefinir-senha`. */
  url: string;
  /** Destinatário, exibido no rodapé como prova de para quem o e-mail foi. */
  email: string;
  /** Origem pública do app, para os logos virarem URL absoluta. */
  appUrl: string;
  /** Escola que cadastrou a pessoa. Nula quando a conta ainda não tem vínculo. */
  schoolName?: string | null;
  expiresInMinutes?: number;
};

/** Nome de escola não pode quebrar o cabeçalho do e-mail. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Primeiro acesso de quem foi cadastrado pela escola.
 *
 * Duas diferenças em relação ao e-mail de senha, e as duas são de propósito:
 *
 * - **Quem pediu foi a escola.** A pessoa não clicou em "esqueci a senha"; dizer que ela
 *   pediu algo gera desconfiança ("não pedi nada, é golpe?").
 * - **O botão cria a senha, não entra.** Link que autentica sozinho transforma quem abriu
 *   a caixa em dono da conta — e a caixa do responsável costuma ser compartilhada com o
 *   aluno e com a família.
 */
export function buildInvitationEmail({
  url,
  email,
  appUrl,
  schoolName,
  expiresInMinutes = 30,
}: InvitationEmailInput): EmailContent {
  const safeEmail = escapeHtml(email);
  const safeSchool = schoolName ? escapeHtml(schoolName) : null;
  const validFor = `${expiresInMinutes} minutos`;
  const from = safeSchool ? `A escola <strong>${safeSchool}</strong>` : "Sua escola";
  const fromText = schoolName ? `A escola ${schoolName}` : "Sua escola";

  return buildLinkEmail({
    url,
    email,
    appUrl,
    expiresInMinutes,
    copy: {
      subject: schoolName
        ? `${headerSafe(schoolName)} criou seu acesso ao NextGen`
        : "Sua escola criou seu acesso ao NextGen",
      heading: "Sua escola criou seu acesso",
      subheading: "Escolha uma senha para entrar.",
      preview: `Convite da escola, válido por ${validFor}.`,
      introHtml: `${from} cadastrou <strong>${safeEmail}</strong> no NextGen. Toque no botão
        para criar sua senha — é com ela que você entra no painel daqui em diante.`,
      introText: `${fromText} cadastrou ${email} no NextGen. Abra o link para criar sua senha.`,
      cta: "Criar minha senha",
      noticeHtml: `<strong>Não conhece esta escola?</strong> Ignore este e-mail. Sem esse
                    clique ninguém cria senha, e o link expira sozinho em ${validFor}.`,
      noticeText: `Não conhece esta escola? Ignore este e-mail. O link expira em ${validFor}.`,
    },
  });
}
