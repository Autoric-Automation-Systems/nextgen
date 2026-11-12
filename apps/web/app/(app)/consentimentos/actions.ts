"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { grantConsent, resolvePurpose, revokeConsent } from "@/lib/consent";

export type ConsentFormState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function grant(prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  return change(prev, formData, "grant");
}

export async function revoke(prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  return change(prev, formData, "revoke");
}

/**
 * Autorizar e revogar são a mesma operação com sinal trocado: mesma checagem de sessão,
 * mesmo escopo de aluno, mesma trilha de auditoria.
 */
async function change(
  _prev: ConsentFormState,
  formData: FormData,
  kind: "grant" | "revoke",
): Promise<ConsentFormState> {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);

  // `consent:grant` é exclusivo do responsável: nem a administração aceita termo no lugar
  // da família, porque consentimento é ato do titular (LGPD art. 8º).
  if (!workspace || !workspace.can("consent:grant")) {
    return { status: "error", message: "Só o responsável autoriza pelo portal." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  // O formulário manda o código do banco (`public_card`); o core fala `publicCard`.
  const purpose = resolvePurpose(String(formData.get("purpose") ?? ""));
  if (!studentId || !purpose) {
    return { status: "error", message: "Pedido de consentimento inválido." };
  }

  // Consentimento específico: a caixa nasce desmarcada e é o ato de aceite, não decoração.
  if (kind === "grant" && formData.get("ack") !== "on") {
    return { status: "error", message: "Marque a caixa confirmando que leu o termo." };
  }

  const headerList = await headers();
  const input = {
    studentId,
    purpose,
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent")?.slice(0, 255) ?? null,
  };

  try {
    const result =
      kind === "grant"
        ? await grantConsent({ schoolId: workspace.schoolId, userId: session.userId }, input)
        : await revokeConsent({ schoolId: workspace.schoolId, userId: session.userId }, input);

    // A lista e o card do aluno mudam juntos: revalidar as duas rotas evita a família
    // ver "autorizado" na tela de consentimento e "card fora do ar" no perfil.
    revalidatePath("/consentimentos");
    revalidatePath(`/alunos/${studentId}`);
    revalidatePath("/alunos");

    return { status: result.status, message: result.message };
  } catch (error) {
    console.error(`[consentimentos] falha ao ${kind === "grant" ? "autorizar" : "revogar"}`, error);
    return { status: "error", message: "Não foi possível registrar agora. Tente novamente." };
  }
}
