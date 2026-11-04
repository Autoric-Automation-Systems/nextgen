/**
 * Transporte de e-mail do link mágico, sem efeitos colaterais de import — o health
 * check precisa saber qual transporte está ativo sem abrir conexão com o banco.
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type Mailer = {
  send(message: MailMessage): Promise<void>;
};

/** Em desenvolvimento o link aparece no log. Nunca use em produção: o log vira login. */
export const consoleMailer: Mailer = {
  async send(message) {
    console.info(`[mail] para=${message.to} assunto="${message.subject}"\n${message.text}`);
  },
};

export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend respondeu ${response.status} ao enviar para ${message.to}`);
      }
    },
  };
}

/**
 * Falha em vez de imprimir o link. Sem e-mail configurado, o console seria um
 * vazamento: quem lê o log entra na conta de qualquer pessoa.
 */
const misconfiguredMailer: Mailer = {
  async send(message) {
    console.error(
      "[mail] nenhum provedor configurado (RESEND_API_KEY + MAIL_FROM); e-mail descartado para",
      message.to,
    );
    throw new Error("provedor de e-mail não configurado");
  },
};

/** Qual transporte está ativo. Exposto no health check para pegar erro de config. */
export function mailTransport(): "console" | "resend" | "missing" {
  if (process.env.MAIL_TRANSPORT === "console" && process.env.VERCEL_ENV !== "production") {
    return "console";
  }
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return "resend";
  return process.env.NODE_ENV === "production" ? "missing" : "console";
}
export function defaultMailer(): Mailer {
  switch (mailTransport()) {
    case "resend":
      return resendMailer(process.env.RESEND_API_KEY!, process.env.MAIL_FROM!);
    case "console":
      return consoleMailer;
    default:
      return misconfiguredMailer;
  }
}
