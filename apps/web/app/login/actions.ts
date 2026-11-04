"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@nextgen/auth";
import { redirect } from "next/navigation";

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

  try {
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        callbackURL: parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard",
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
