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
 * Cadastro = link por e-mail. A senha é escolhida depois do clique, em `/definir-senha`:
 * assim ninguém cria acesso com um endereço que não é seu.
 *
 * O login do dia a dia é e-mail + senha. Este caminho fica para o primeiro acesso e para
 * quem foi convidado pela escola.
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
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        callbackURL: "/definir-senha",
        // Sem isto, a falha na verificação volta para `/dashboard`, que exige sessão e
        // redireciona para o login — descartando o motivo.
        errorCallbackURL: "/cadastro",
      },
    });
  } catch {
    // Resposta idêntica para e-mail existente e inexistente: não confirmamos cadastro
    // a quem só tem o endereço (enumeração de usuários).
    return { status: "sent" };
  }

  return { status: "sent" };
}
