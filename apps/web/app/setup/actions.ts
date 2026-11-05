"use server";

import { headers } from "next/headers";
import { auth } from "@nextgen/auth";
import { createFirstAdmin } from "@/lib/first-run";
import { firstRunSchema, type SetupResult } from "@/lib/setup-rules";

export type SetupState =
  | { status: "idle" }
  | { status: "created"; email: string }
  | { status: "error"; message: string };

/**
 * Cria a primeira escola e já manda o link de acesso.
 *
 * O envio é best-effort: a conta existe depois da transação, então uma falha no SMTP
 * vira uma instrução ("peça o link em /login") em vez de um erro que sugere que nada
 * foi gravado.
 */
export async function setupFirstSchool(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = firstRunSchema.safeParse({
    adminName: formData.get("adminName"),
    email: formData.get("email"),
    schoolName: formData.get("schoolName"),
    schoolLegalName: formData.get("schoolLegalName"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const result: SetupResult = await createFirstAdmin(parsed.data);

  if (result.status === "already") {
    return {
      status: "error",
      message: "Esta instalação já tem escola configurada. Entre pela tela de login.",
    };
  }

  if (result.status === "unavailable") {
    return { status: "error", message: result.message };
  }

  try {
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: { email: result.email, callbackURL: "/dashboard", errorCallbackURL: "/login" },
    });
  } catch (error) {
    console.error("[setup] conta criada, link não enviado", error);
  }

  return { status: "created", email: result.email };
}
