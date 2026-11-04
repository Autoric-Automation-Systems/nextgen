/**
 * Transporte de e-mail do link mágico, sem efeitos colaterais de import — o health
 * check precisa saber qual transporte está ativo sem abrir conexão com o banco.
 */
import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type Mailer = {
  send(message: MailMessage): Promise<void>;
};

/**
 * SMTP genérico (Gmail, Workspace, Zoho, Mailgun SMTP). O Gmail exige *senha de app*
 * — a senha da conta é recusada com 535 mesmo com 2FA ligado, porque o login OAuth
 * não é aceito por SMTP simples.
 *
 * `pool: false` de propósito: cada invocação de função é curta e um pool por função
 * só mantém socket aberto sem reuso real, atrasando o congelamento da lambda.
 */
export function smtpMailer(options: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}): Mailer {
  let transport: Transporter | null = null;

  return {
    async send(message) {
      transport ??= nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth: { user: options.user, pass: options.pass },
        pool: false,
        // Sem estes limites a função pendura até o timeout da Vercel quando o
        // provedor não responde — e o usuário fica olhando "enviando…".
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });

      try {
        await transport.sendMail({
          from: options.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (error) {
        // A mensagem do nodemailer cita o comando SMTP e o provedor, nunca a senha.
        const reason = error instanceof Error ? error.message : "erro desconhecido";
        throw new Error(`SMTP recusou o envio para ${message.to}: ${reason}`);
      }
    },
  };
}

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
      "[mail] nenhum provedor configurado (EMAIL_USER + EMAIL_PASS, ou RESEND_API_KEY + MAIL_FROM); e-mail descartado para",
      message.to,
    );
    throw new Error("provedor de e-mail não configurado");
  },
};

/** Porta 465 é SMTP sobre TLS implícito; 587 abre em claro e sobe via STARTTLS. */
export function smtpConfig(env: Record<string, string | undefined> = process.env) {
  const user = env.EMAIL_USER;
  const pass = env.EMAIL_PASS;
  if (!user || !pass) return null;

  // Variável declarada vazia na Vercel chega como "", não como ausente: `??` não
  // basta, senão EMAIL_HOST="" anula o padrão do Gmail.
  const port = Number(env.EMAIL_PORT || 465);
  const host = env.EMAIL_HOST || (user.endsWith("@gmail.com") ? "smtp.gmail.com" : "");

  if (!host || !Number.isFinite(port) || port <= 0) return null;

  return {
    host,
    port,
    secure: env.EMAIL_SECURE ? env.EMAIL_SECURE !== "false" : port === 465,
    user,
    pass,
    // Gmail reescreve o From para a conta autenticada quando o endereço não é alias
    // verificado — o e-mail chega, mas com outro remetente. Melhor assumir o padrão.
    from: env.MAIL_FROM || `NextGen <${user}>`,
  };
}

/**
 * Abre e fecha um TCP com o servidor SMTP configurado. Existe porque "mail: smtp"
 * só prova que as variáveis existem: se a rede da Vercel bloquear a porta, o envio
 * falha com timeout e a mensagem de erro não diz que o bloqueio é de rede.
 *
 * Não autentica e não envia nada. Alvo é sempre o host da configuração, nunca um
 * parâmetro de requisição.
 */
/**
 * Autentica no SMTP sem enviar mensagem (`AUTH` + `NOOP`).
 *
 * `probeSmtp` só prova que a porta abre; a senha de app recusada pelo Gmail produz o
 * mesmo "alcançável" e o mesmo silêncio na tela, porque o erro do envio não chega ao
 * usuário (não se confirma existência de conta). Este é o único jeito de separar
 * "rede ok" de "credencial ok" sem depender do log do deploy.
 */
export async function verifySmtp(
  timeoutMs = 8_000,
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  const config = smtpConfig();
  if (!config) return { ok: false, code: "nao-configurado", detail: "EMAIL_USER/EMAIL_PASS ausentes" };

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    pool: false,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { response?: string };
    // `response` do SMTP cita usuário e o código 535, nunca a senha.
    const detail = (err.response ?? err.message ?? "").replace(/\s+/g, " ").slice(0, 160);
    return { ok: false, code: err.code ?? "desconhecido", detail };
  } finally {
    transport.close();
  }
}

export async function probeSmtp(
  config: { host: string; port: number },
  timeoutMs = 5_000,
): Promise<{ reachable: boolean; banner?: string; error?: string }> {
  const net = await import("node:net");

  return new Promise((resolve) => {
    const socket = net.connect({ host: config.host, port: config.port });
    let banner = "";
    let settled = false;

    const finish = (result: { reachable: boolean; banner?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      // Porta 465 é TLS implícito: o servidor só fala depois do handshake, então
      // conexão aceita já é a resposta que interessa.
      if (config.port === 465) return finish({ reachable: true });
    });
    socket.on("data", (chunk) => {
      banner += chunk.toString();
      if (banner.includes("\n") || banner.length > 120) {
        finish({ reachable: true, banner: sanitizeBanner(banner) });
      }
    });
    socket.on("timeout", () => finish({ reachable: false, error: "timeout" }));
    socket.on("error", (error: NodeJS.ErrnoException) =>
      finish({ reachable: false, error: error.code ?? "erro de rede" }),
    );
    socket.on("close", () => finish({ reachable: false, error: "conexão fechada" }));
  });
}

function sanitizeBanner(banner: string): string {
  return banner.split("\n")[0]!.replace(/[^\x20-\x7e]/g, "").slice(0, 80).trim();
}

/** Qual transporte está ativo. Exposto no health check para pegar erro de config. */
export function mailTransport(): "console" | "smtp" | "resend" | "missing" {
  if (process.env.MAIL_TRANSPORT === "console" && process.env.VERCEL_ENV !== "production") {
    return "console";
  }
  if (process.env.MAIL_TRANSPORT === "smtp" && smtpConfig()) return "smtp";
  if (smtpConfig()) return "smtp";
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return "resend";
  return process.env.NODE_ENV === "production" ? "missing" : "console";
}
export function defaultMailer(): Mailer {
  switch (mailTransport()) {
    case "smtp":
      return smtpMailer(smtpConfig()!);
    case "resend":
      return resendMailer(process.env.RESEND_API_KEY!, process.env.MAIL_FROM!);
    case "console":
      return consoleMailer;
    default:
      return misconfiguredMailer;
  }
}
