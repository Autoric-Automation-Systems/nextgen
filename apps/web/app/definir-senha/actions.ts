"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth, checkNewPassword } from "@nextgen/auth";
import { getCurrentSession } from "@/lib/session";

const schema = z.object({
  password: z.string(),
  confirmation: z.string(),
});

export type SetPasswordState = { status: "idle" | "error"; message?: string };

/**
 * Primeira senha, logo depois do link de cadastro. Exige sessão de propósito: quem chega
 * aqui provou o e-mail ao clicar no link, e só assim vira credencial.
 */
export async function setInitialPassword(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=%2Fdefinir-senha");

  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Informe a senha duas vezes." };
  }

  const verdict = checkNewPassword(parsed.data.password, parsed.data.confirmation, session.email);
  if (!verdict.ok) return { status: "error", message: verdict.message };

  try {
    await auth.api.setPassword({
      headers: await headers(),
      body: { newPassword: parsed.data.password },
    });
  } catch (error) {
    unstable_rethrow(error);

    const code = (error as { body?: { code?: string } }).body?.code;

    if (code === "PASSWORD_ALREADY_SET") {
      redirect("/dashboard");
    }

    console.error("[senha] falha ao definir senha", error);
    return {
      status: "error",
      message: "Não foi possível salvar a senha agora. Tente novamente em instantes.",
    };
  }

  redirect("/dashboard?senha=definida");
}
