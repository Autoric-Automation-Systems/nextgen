"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@nextgen/auth";
import { ensureBootstrapAdmin } from "@/lib/bootstrap-admin";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export type SignupState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * Primeiro acesso = link por e-mail que **cria a senha**, em `/redefinir-senha`.
 *
 * O link não autentica sozinho: quem abre a caixa ainda escolhe a senha. Isso protege a
 * conta quando o e-mail é compartilhado (o do responsável costuma ser) e mantém a senha
 * como o único jeito de entrar no dia a dia.
 */
export async function requestSignupLink(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = schema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Numa instalação sem usuários, o link sai mas a verificação morre em
  // `new_user_signup_disabled` (`disableSignUp`): o e-mail chega e não abre nada. Aqui o
  // primeiro acesso cria o usuário e a escola antes de pedir o link. Falhar nesta etapa
  // não pode impedir a tentativa de cadastro, por isso o `catch` próprio.
  try {
    const outcome = await ensureBootstrapAdmin(parsed.data.email);
    if (outcome.status !== "none") console.info("[cadastro] primeiro acesso", outcome);
  } catch {
    // silêncio: o envio abaixo é quem decide o que o usuário vê
  }

  try {
    await auth.api.requestPasswordReset({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        // A página que recebe o token é a que grava a senha; o token chega validado pelo
        // Better Auth em `/api/auth/reset-password/:token`.
        redirectTo: "/redefinir-senha",
      },
    });
  } catch {
    // Resposta idêntica para e-mail existente e inexistente: não confirmamos cadastro
    // a quem só tem o endereço (enumeração de usuários).
    return { status: "sent" };
  }

  return { status: "sent" };
}
