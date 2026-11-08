"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth, checkNewPassword } from "@nextgen/auth";

const schema = z.object({
  token: z.string().trim().min(1, "Link inválido."),
  password: z.string(),
  confirmation: z.string(),
});

export type ResetState = { status: "idle" | "error"; message?: string };

/**
 * Grava a senha nova a partir do token do e-mail.
 *
 * O token é de uso único e o Better Auth o consome dentro da transação que grava a
 * senha: se a gravação falhar, o link continua valendo. O e-mail do usuário não aparece
 * aqui — o servidor não precisa dele para saber de quem é o token.
 */
export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Link inválido." };
  }

  // Sem o e-mail aqui: o servidor só tem o token, e o token já foi entregue na caixa
  // certa. A regra "senha não contém o e-mail" roda em `/definir-senha`, onde a sessão
  // conhece o endereço.
  const verdict = checkNewPassword(parsed.data.password, parsed.data.confirmation);
  if (!verdict.ok) return { status: "error", message: verdict.message };

  try {
    await auth.api.resetPassword({
      headers: await headers(),
      body: { newPassword: parsed.data.password, token: parsed.data.token },
    });
  } catch (error) {
    unstable_rethrow(error);

    const code = (error as { body?: { code?: string } }).body?.code;

    if (code === "INVALID_TOKEN") {
      return {
        status: "error",
        message: "Este link já foi usado ou expirou. Peça um novo em «Esqueci minha senha».",
      };
    }

    console.error("[senha] falha ao redefinir", error);
    return {
      status: "error",
      message: "Não foi possível salvar a senha agora. Tente novamente em instantes.",
    };
  }

  // Sessões antigas foram revogadas junto com a troca: entrar de novo é o próximo passo.
  redirect("/login?senha=1");
}
