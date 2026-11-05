"use server";

import { headers } from "next/headers";
import { prisma } from "@nextgen/db";
import { allowRequest, looksLikeBot, schoolLeadSchema } from "@/lib/school-lead";

export type LeadState = { status: "idle" | "sent" | "error"; message?: string };

/**
 * Registra o pedido de cadastro de escola.
 *
 * Grava com `$executeRaw` e não com `create` de propósito: o papel de runtime só tem
 * INSERT nesta tabela, e `INSERT ... RETURNING` — que o `create` usa — exige SELECT e
 * devolveria a linha. Escrever sem ler é o desenho, não uma limitação contornada.
 */
export async function requestSchoolAccess(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  // Resposta de sucesso sem gravar: robô não aprende qual campo evitar.
  if (looksLikeBot(formData)) return { status: "sent" };

  const parsed = schoolLeadSchema.safeParse({
    schoolName: formData.get("schoolName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    city: formData.get("city"),
    studentCount: formData.get("studentCount"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "dados inválidos" };
  }

  const origin = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecida";
  if (!allowRequest(origin)) {
    return {
      status: "error",
      message: "Recebemos vários pedidos deste endereço. Tente de novo em alguns minutos.",
    };
  }

  const lead = parsed.data;

  try {
    await prisma.$executeRaw`
      insert into school_leads
        (id, school_name, contact_name, email, phone, city, student_count, message)
      values
        (gen_random_uuid(), ${lead.schoolName}, ${lead.contactName}, ${lead.email},
         ${lead.phone}, ${lead.city}, ${lead.studentCount}, ${lead.message})
    `;
  } catch (error) {
    console.error("[lead] falha ao registrar pedido de cadastro", error);
    return {
      status: "error",
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }

  return { status: "sent" };
}
