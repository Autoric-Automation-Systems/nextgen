"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, ensureUser } from "@nextgen/auth";
import { withTenant } from "@nextgen/db";
import { decideEnrollment } from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { studentFormSchema } from "@/lib/student-form";

export type StudentState = {
  status: "idle" | "ok" | "error";
  message?: string;
  /** Preenchido no sucesso: a secretaria costura o card sem procurar o aluno na lista. */
  studentId?: string;
};

const ok = (message: string, studentId?: string): StudentState => ({ status: "ok", message, studentId });
const fail = (message: string): StudentState => ({ status: "error", message });

type Created = { ok: true; studentId: string } | { ok: false; message: string };

/**
 * Cadastro do aluno com responsável financeiro.
 *
 * O aluno nasce sem login: quem entra é o responsável. Criar o `User` do responsável aqui
 * — em vez de esperar um cadastro espontâneo — é o que permite a cobrança automática
 * funcionar antes do primeiro acesso dele: o e-mail já é o destino do PIX.
 */
export async function createStudent(_prev: StudentState, formData: FormData): Promise<StudentState> {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can("student:write")) {
    return fail("Seu perfil não cadastra aluno.");
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = studentFormSchema.safeParse({
    ...raw,
    // Campo vazio chegaria como "" e `coerce` viraria 0; o padrão do produto é o dia 10.
    dueDay: raw.dueDay?.trim() ? raw.dueDay : "10",
    relation: raw.relation || "legal_guardian",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Confira os dados do aluno.");
  }

  const data = parsed.data;

  try {
    // Resolvido fora do tenant e antes da transação: a política de `users` impede o papel
    // de aplicação de criar conta de outra pessoa (ver `ensureUser`), e a transação não
    // fica aberta esperando outra conexão.
    const user = await ensureUser(data.guardianName, data.guardianEmail);

    const created = await withTenant(
      { schoolId: workspace.schoolId, userId: session.userId },
      async (tx): Promise<Created> => {
        const plan = data.tuitionPlanId
          ? await tx.tuitionPlan.findFirst({ where: { id: data.tuitionPlanId } })
          : null;
        if (data.tuitionPlanId && !plan) return { ok: false, message: "Plano de mensalidade não encontrado." };

        const group = data.classGroupId
          ? await tx.classGroup.findFirst({
              where: { id: data.classGroupId, deletedAt: null },
              select: { id: true, capacity: true, isActive: true },
            })
          : null;
        if (data.classGroupId && !group) return { ok: false, message: "Turma não encontrada." };
        if (group && !group.isActive) return { ok: false, message: "Esta turma está inativa." };

        const student = await tx.student.create({
          data: {
            schoolId: workspace.schoolId,
            fullName: data.fullName,
            nickname: data.nickname,
            birthDate: new Date(`${data.birthDate}T00:00:00.000Z`),
            position: data.position,
            dueDay: data.dueDay,
            tuitionPlanId: data.tuitionPlanId,
            // O card público nasce desligado: publicar dado de criança é decisão do
            // responsável, nunca efeito colateral de um cadastro.
            publicCardEnabled: false,
          },
        });

        // Quem já é professor da casa não perde o papel: membresia é uma linha por
        // usuário e escola.
        const membership = await tx.membership.findFirst({
          where: { schoolId: workspace.schoolId, userId: user.id },
          select: { id: true },
        });
        if (!membership) {
          await tx.membership.create({
            data: { schoolId: workspace.schoolId, userId: user.id, role: "guardian", status: "active" },
          });
        }

        const guardian = await tx.guardian.upsert({
          where: { schoolId_userId: { schoolId: workspace.schoolId, userId: user.id } },
          update: { phone: data.guardianPhone ?? undefined },
          create: {
            schoolId: workspace.schoolId,
            userId: user.id,
            phone: data.guardianPhone,
            relationDefault: data.relation,
          },
          select: { id: true },
        });

        await tx.studentGuardian.create({
          data: {
            schoolId: workspace.schoolId,
            studentId: student.id,
            guardianId: guardian.id,
            relation: data.relation,
            isLegal: true,
            isFinancial: true,
            isPickupAuthorized: true,
          },
        });

        if (group) {
          const [activeCount, waitlistCount] = await Promise.all([
            tx.enrollment.count({
              where: { classGroupId: group.id, status: "active", deletedAt: null },
            }),
            tx.enrollment.count({
              where: { classGroupId: group.id, status: "waitlist", deletedAt: null },
            }),
          ]);

          // Sem termo assinado, a regra de matrícula devolve rascunho: o aluno existe,
          // aparece na lista, e nada é liberado ao responsável antes do consentimento.
          const decision = decideEnrollment({
            consent: "missing",
            capacity: group.capacity,
            activeCount,
            waitlistCount,
            alreadyEnrolled: false,
            activeInAnotherGroup: false,
          });

          await tx.enrollment.create({
            data: {
              schoolId: workspace.schoolId,
              studentId: student.id,
              classGroupId: group.id,
              status: decision.status === "waitlist" ? "waitlist" : "draft",
              startsOn: new Date(),
              waitlistPosition: decision.status === "waitlist" ? decision.position : null,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            schoolId: workspace.schoolId,
            actorUserId: session.userId,
            actorRole: workspace.role ?? "admin",
            action: "student.create",
            entity: "student",
            entityId: student.id,
            after: {
              fullName: data.fullName,
              dueDay: data.dueDay,
              tuitionPlanId: data.tuitionPlanId,
              classGroupId: data.classGroupId,
            },
          },
        });

        return { ok: true, studentId: student.id };
      },
    );

    if (!created.ok) return fail(created.message);

    // Convite fora da transação: e-mail lento não segura o cadastro, e falha de envio não
    // desfaz o aluno.
    let invited = true;
    try {
      await auth.api.signInMagicLink({
        headers: await headers(),
        body: {
          email: data.guardianEmail,
          callbackURL: "/definir-senha",
          errorCallbackURL: "/cadastro",
        },
      });
    } catch (error) {
      console.error("[alunos] convite do responsável não saiu", error);
      invited = false;
    }

    revalidatePath("/alunos");
    revalidatePath("/dashboard");

    return ok(
      invited
        ? `Aluno cadastrado. Convite enviado para ${data.guardianEmail}.`
        : `Aluno cadastrado, mas o convite para ${data.guardianEmail} não saiu. Reenvie pelo login em /cadastro.`,
      created.studentId,
    );
  } catch (error) {
    console.error("[alunos] falha no cadastro", error);
    return fail("Não foi possível cadastrar o aluno agora. Tente novamente.");
  }
}
