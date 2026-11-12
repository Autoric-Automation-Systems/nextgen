"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, ensureUser, hasPassword } from "@nextgen/auth";
import { withTenant } from "@nextgen/db";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { INVITABLE_ROLES, ROLE_LABELS, isInvitableRole } from "@/lib/team";

export type TeamState = { status: "idle" | "ok" | "error"; message?: string };

const GUARDIAN_IS_NOT_STAFF =
  "Este e-mail é de responsável por aluno. Use outro e-mail para o cargo de equipe: mudar o vínculo tiraria o acesso dele aos filhos.";

const ok = (message: string): TeamState => ({ status: "ok", message });
const fail = (message: string): TeamState => ({ status: "error", message });

const inviteSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  role: z.enum(INVITABLE_ROLES),
});

/** `teacher:manage` é da administração: coordenação vê a equipe, não a edita. */
async function manager() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can("teacher:manage")) return null;
  return { session, workspace };
}

export async function inviteMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const context = await manager();
  if (!context) return fail("Só a administração da escola convida a equipe.");
  const { session, workspace } = context;

  const parsed = inviteSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "teacher"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Confira os dados do convite.");

  const data = parsed.data;
  const groupIds = formData.getAll("classGroupIds").map(String).filter(Boolean);

  // Fora da transação: a conta vive nas tabelas de autenticação e sobrevive a um erro
  // aqui. Usuário sem vínculo é inofensivo; transação aberta esperando e-mail, não.
  const user = await ensureUser(data.name, data.email);

  try {
    const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
      const existing = await tx.membership.findFirst({
        where: { userId: user.id },
        select: { id: true, role: true },
      });

      // Um `membership` por pessoa e escola: transformar responsável em professor tiraria
      // dele o acesso aos próprios filhos. Melhor recusar do que trocar o papel em silêncio.
      if (existing?.role === "guardian") return fail(GUARDIAN_IS_NOT_STAFF);

      if (existing) {
        await tx.membership.update({
          where: { id: existing.id },
          data: { role: data.role, status: "active", revokedAt: null },
        });
      } else {
        await tx.membership.create({
          data: { schoolId: workspace.schoolId, userId: user.id, role: data.role, status: "active" },
        });
      }

      if (data.role === "teacher" && groupIds.length > 0) {
        const groups = await tx.classGroup.findMany({
          where: { id: { in: groupIds }, deletedAt: null },
          select: { id: true },
        });
        // Turma apagada entre abrir a tela e enviar o formulário não vira vínculo.
        for (const group of groups) {
          const open = await tx.classGroupTeacher.findFirst({
            where: { classGroupId: group.id, userId: user.id, toDate: null },
            select: { id: true },
          });
          if (open) continue;
          await tx.classGroupTeacher.create({
            data: {
              schoolId: workspace.schoolId,
              classGroupId: group.id,
              userId: user.id,
              fromDate: new Date(),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role ?? "admin",
          action: "membership.invite",
          entity: "membership",
          entityId: user.id,
          after: { email: data.email, role: data.role, classGroupIds: groupIds },
        },
      });

      return ok(`${data.name} entrou como ${ROLE_LABELS[data.role].toLowerCase()}.`);
    });

    if (result.status === "error") return result;

    // Convite fora da transação: e-mail lento não segura a tela, e falha de SMTP não
    // desfaz o vínculo — a pessoa continua podendo entrar por "esqueci a senha".
    const invited = await sendAccessLink(data.email, user.id);

    revalidatePath("/equipe");
    revalidatePath("/turmas");

    return ok(
      invited
        ? `${result.message} Convite enviado para ${data.email}.`
        : `${result.message} O convite não saiu; use "Reenviar convite" mais tarde.`,
    );
  } catch (error) {
    console.error("[equipe] falha ao convidar", error);
    return fail("Não foi possível convidar agora. Tente novamente.");
  }
}

export async function setMemberRole(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const context = await manager();
  if (!context) return fail("Só a administração muda o cargo de alguém.");
  const { session, workspace } = context;

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !isInvitableRole(role)) return fail("Cargo inválido.");
  if (userId === session.userId) return fail("Você não muda o próprio cargo. Peça a outra pessoa da administração.");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
      const membership = await tx.membership.findFirst({ where: { userId }, select: { id: true, role: true } });
      if (!membership) return fail("Pessoa não encontrada nesta escola.");
      // Responsável não é equipe: promover aqui apagaria o acesso dele aos próprios filhos.
      if (membership.role === "guardian") return fail(GUARDIAN_IS_NOT_STAFF);

      if (membership.role === "admin" && role !== "admin") {
        const admins = await tx.membership.count({ where: { role: "admin", status: "active" } });
        if (admins <= 1) return fail("A escola ficaria sem administração. Promova outra pessoa antes.");
      }

      await tx.membership.update({ where: { id: membership.id }, data: { role } });
      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role ?? "admin",
          action: "membership.role_change",
          entity: "membership",
          entityId: membership.id,
          before: { role: membership.role },
          after: { role },
        },
      });

      return ok(`Cargo atualizado para ${ROLE_LABELS[role].toLowerCase()}.`);
    });

    revalidatePath("/equipe");
    return result;
  } catch (error) {
    console.error("[equipe] falha ao mudar cargo", error);
    return fail("Não foi possível mudar o cargo agora.");
  }
}

/**
 * Tira ou devolve o acesso.
 *
 * Revogar o vínculo **não** apaga a pessoa nem o histórico: presença, avaliações e aulas
 * seguem ligadas a quem as fez. Só o acesso ao sistema cai.
 */
export async function setMemberStatus(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const context = await manager();
  if (!context) return fail("Só a administração revoga acesso.");
  const { session, workspace } = context;

  const userId = String(formData.get("userId") ?? "");
  const suspend = formData.get("suspend") === "on";
  if (!userId) return fail("Pessoa inválida.");
  if (userId === session.userId) return fail("Você não revoga o próprio acesso.");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { userId },
        select: { id: true, role: true, status: true },
      });
      if (!membership) return fail("Pessoa não encontrada nesta escola.");
      if (membership.role === "guardian") return fail(GUARDIAN_IS_NOT_STAFF);

      if (suspend && membership.role === "admin") {
        const admins = await tx.membership.count({ where: { role: "admin", status: "active" } });
        if (admins <= 1) return fail("A escola ficaria sem administração ativa.");
      }

      await tx.membership.update({
        where: { id: membership.id },
        data: suspend
          ? { status: "revoked", revokedAt: new Date() }
          : { status: "active", revokedAt: null },
      });

      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role ?? "admin",
          action: suspend ? "membership.revoke" : "membership.reactivate",
          entity: "membership",
          entityId: membership.id,
          before: { status: membership.status },
        },
      });

      return ok(suspend ? "Acesso revogado." : "Acesso devolvido.");
    });

    revalidatePath("/equipe");
    return result;
  } catch (error) {
    console.error("[equipe] falha ao mudar acesso", error);
    return fail("Não foi possível mudar o acesso agora.");
  }
}

export async function resendInvite(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const context = await manager();
  if (!context) return fail("Só a administração reenvia convite.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const userId = String(formData.get("userId") ?? "");
  if (!email) return fail("Convite inválido.");

  const sent = await sendAccessLink(email, userId || undefined);
  return sent
    ? ok(`Convite reenviado para ${email}.`)
    : fail("O e-mail não saiu agora. Tente de novo em alguns minutos.");
}

/**
 * Link de acesso.
 *
 * Quem já tem senha cai no painel; quem nunca entrou vai definir a senha. Mandar todo
 * mundo para `/definir-senha` faria um professor antigo trocar a senha só para entrar numa
 * segunda escola.
 */
async function sendAccessLink(email: string, userId?: string): Promise<boolean> {
  try {
    const alreadyHasPassword = userId ? await hasPassword(userId) : false;
    await auth.api.signInMagicLink({
      headers: await headers(),
      body: {
        email,
        callbackURL: alreadyHasPassword ? "/dashboard" : "/definir-senha",
        errorCallbackURL: "/login",
      },
    });
    return true;
  } catch (error) {
    console.error("[equipe] convite não saiu", error);
    return false;
  }
}
