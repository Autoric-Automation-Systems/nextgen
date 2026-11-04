import type { Mailer } from "./mail";

/**
 * Mascara o endereço para log: `ana@escola.com` vira `a***@escola.com`.
 *
 * O domínio fica porque é ele que distingue "o convite foi para o e-mail errado" de
 * "o provedor recusou"; a parte local é o dado pessoal.
 */
export function maskAddress(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";

  const head = email.slice(0, 1);
  return `${head}***@${email.slice(at + 1)}`;
}

/** Erro de provedor não traz a senha, mas pode ser longo; o suficiente é o começo. */
function shortDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").slice(0, 300);
}

let client: { mailLog: { create: (args: unknown) => Promise<unknown> } } | null = null;

async function record(
  kind: string,
  recipient: string,
  status: "enviado" | "erro",
  detail?: string,
): Promise<void> {
  try {
    if (!client) {
      const { createAdminClient } = await import("@nextgen/db");
      client = createAdminClient() as unknown as typeof client;
    }

    await client!.mailLog.create({
      data: { kind, recipient: maskAddress(recipient), status, detail },
    });
  } catch (error) {
    // Registrar é diagnóstico; falhar aqui não pode impedir a entrega.
    console.error("[mail] tentativa não registrada:", shortDetail(error));
  }
}

/**
 * Envolve um transporte para registrar cada tentativa.
 *
 * Existe porque "o e-mail não chegou" tem causas que produzem a mesma tela: endereço sem
 * usuário (o `disableSignUp` barra e nenhum e-mail é enviado), senha de app recusada pelo
 * Gmail, porta bloqueada. Sem registro, descobrir qual delas exige o log da Vercel, que
 * não é alcançável de fora do deploy.
 */
export function loggingMailer(inner: Mailer, kind = "magic-link"): Mailer {
  return {
    async send(message) {
      try {
        await inner.send(message);
        await record(kind, message.to, "enviado");
      } catch (error) {
        await record(kind, message.to, "erro", shortDetail(error));
        throw error;
      }
    },
  };
}
