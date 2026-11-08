"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { auth } from "@nextgen/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  remember: z.string().optional(),
  next: z.string().optional(),
});

export type LoginState = { status: "idle" | "error"; message?: string };

/**
 * Só caminho interno. `//evil.com` é URL absoluta disfarçada: o navegador trata as duas
 * barras como protocolo relativo e sairia para outro site depois do login.
 */
function safeNext(value: string | undefined): string {
  if (!value) return "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/**
 * Código de erro do Better Auth. Ele não é público na tipagem do erro, e a alternativa —
 * comparar texto de mensagem — quebra a cada versão da biblioteca.
 */
function errorCode(error: unknown): string | null {
  const body = (error as { body?: { code?: string } }).body;
  return typeof body?.code === "string" ? body.code : null;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") ?? undefined,
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const destination = safeNext(parsed.data.next);

  try {
    await auth.api.signInEmail({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe: parsed.data.remember === "on",
      },
    });
  } catch (error) {
    unstable_rethrow(error);

    const code = errorCode(error);

    if (code === "TOO_MANY_REQUESTS" || code === "RATE_LIMITED") {
      return {
        status: "error",
        message: "Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.",
      };
    }

    if (code === "EMAIL_NOT_VERIFIED") {
      return {
        status: "error",
        message: "Este e-mail ainda não foi confirmado. Peça um link em «Primeiro acesso».",
      };
    }

    // Uma mensagem só para senha errada e para e-mail sem conta: separar as duas
    // transformaria o formulário em um verificador de quem tem acesso ao sistema.
    return {
      status: "error",
      message: "E-mail ou senha incorretos. Se ainda não definiu a senha, use «Esqueci minha senha».",
    };
  }

  redirect(destination);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login?saida=1");
}
