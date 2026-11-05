"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@nextgen/auth";
import { redirect } from "next/navigation";
import { ensureBootstrapAdmin } from "@/lib/bootstrap-admin";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("e-mail inválido"),
  next: z.string().optional(),
});

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  // Numa instalação sem usuários, o link sai mas a verificação morre em
  // `new_user_signup_disabled` (`disableSignUp`): o e-mail chega e não abre nada. Aqui o
  // primeiro acesso cria o usuário e a escola antes de pedir o link. Falhar nesta etapa
  // não pode impedir a tentativa de login, por isso o `catch` próprio.
  try {
    const outcome = await ensureBootstrapAdmin(parsed.data.email);
    if (outcome.status !== "none") console.info("[login] primeiro acesso", outcome);
  } catch {
    // silêncio: o login abaixo é quem decide o que o usuário vê
  }

  try {
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        callbackURL: parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard",
        // Sem isto, a falha na verificação do link volta para `/dashboard`, que exige
        // sessão e redireciona para cá — descartando o motivo. O usuário vê "voltou pro
        // login" e nada mais.
        errorCallbackURL: "/login",
      },
    });
  } catch {
    // Resposta idêntica para e-mail existente e inexistente: não confirmamos cadastro
    // a quem só tem o endereço (enumeração de usuários).
    return { status: "sent" };
  }

  return { status: "sent" };
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
