"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { defaultBaseURL } from "@nextgen/auth";
import { auth } from "@nextgen/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export type ForgotState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * Pede o link de senha.
 *
 * A resposta é sempre a mesma, com conta ou sem conta: separar as duas transformaria o
 * formulário em um verificador de quem tem acesso ao sistema. O Better Auth já gasta o
 * mesmo tempo nos dois casos (gera um token falso quando não acha o usuário).
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const parsed = schema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await auth.api.requestPasswordReset({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        // Para onde o clique no e-mail leva. Precisa ser URL absoluta: o Better Auth
        // valida a origem antes de redirecionar.
        redirectTo: `${defaultBaseURL()}/redefinir-senha`,
      },
    });
  } catch {
    return { status: "sent" };
  }

  return { status: "sent" };
}
