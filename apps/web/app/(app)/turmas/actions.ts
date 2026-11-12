"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { withTenant } from "@nextgen/db";
import {
  BLOCKED_TEXT,
  decideEnrollment,
  formatSchedule,
  overlaps,
  parseTime,
  resolveOverriddenEnrollment,
  scheduleIssueText,
  seatsLeft,
  validOverrideReason,
  validateSchedule,
} from "@nextgen/core";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";

export type TurmaState = { status: "idle" | "ok" | "error"; message?: string };

const ok = (message: string): TurmaState => ({ status: "ok", message });
const fail = (message: string): TurmaState => ({ status: "error", message });

async function editor() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can("enrollment:write")) return null;
  return { session, workspace };
}

async function teacherManager() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can("teacher:manage")) return null;
  return { session, workspace };
}

export async function createClassGroup(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await editor();
  if (!context) return fail("Seu perfil não cria turma.");
  const { session, workspace } = context;

  const unitIdInput = String(formData.get("unitId") ?? "").trim();
  const roomIdInput = String(formData.get("roomId") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const capacity = Number(formData.get("capacity") ?? 20);
  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
  const rawName = String(formData.get("name") ?? "").trim();

  const schedule = validateSchedule({ weekdays, startTime, endTime });
  if (!schedule.ok) return fail(scheduleIssueText(schedule.issue));
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return fail("Capacidade precisa ser um número entre 1 e 100.");
  }
  if (parseTime(startTime) === null || parseTime(endTime) === null) {
    return fail("Use horário no formato 17:00.");
  }

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const unit = unitIdInput
        ? await tx.unit.findFirst({ where: { id: unitIdInput, deletedAt: null } })
        : await tx.unit.findFirst({ where: { deletedAt: null }, orderBy: { isPrimary: "desc" } });
      if (!unit) return fail("Cadastre uma unidade (endereço) antes de abrir turma.");

      if (roomIdInput) {
        const room = await tx.room.findFirst({
          where: { id: roomIdInput, unitId: unit.id, deletedAt: null },
        });
        if (!room) return fail("Sala não pertence a esta unidade.");
      }

      const sameRoom = await tx.classGroup.findMany({
        where: {
          unitId: unit.id,
          roomId: roomIdInput || null,
          deletedAt: null,
          isActive: true,
        },
        select: { name: true, weekdays: true, startTime: true, endTime: true },
      });
      const conflict = sameRoom.find((group) =>
        overlaps(group, { weekdays: schedule.weekdays, startTime, endTime }),
      );
      if (conflict) {
        return fail(
          `Choque de horário com ${conflict.name} (${formatSchedule(conflict)}). Troque o horário ou a sala.`,
        );
      }

      const name = rawName || formatSchedule({ weekdays, startTime, endTime });
      const group = await tx.classGroup.create({
        data: {
          schoolId: workspace.schoolId,
          unitId: unit.id,
          roomId: roomIdInput || null,
          name,
          weekdays: schedule.weekdays,
          startTime,
          endTime,
          capacity,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "class_group.create",
          entity: "class_group",
          entityId: group.id,
          after: {
            name,
            weekdays: schedule.weekdays,
            startTime,
            endTime,
            capacity,
          },
        },
      });

      return ok(`Turma ${name} criada.`);
    });

    if (result.status === "ok") {
      revalidatePath("/turmas");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (error) {
    console.error("[turmas] falha ao criar turma", error);
    return fail("Não foi possível criar a turma agora. Tente novamente.");
  }
}

export async function enrollStudent(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await editor();
  if (!context) return fail("Seu perfil não matricula aluno.");
  const { session, workspace } = context;

  const classGroupId = String(formData.get("classGroupId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const group = await tx.classGroup.findFirst({
        where: { id: classGroupId, deletedAt: null },
        select: { id: true, name: true, capacity: true, isActive: true },
      });
      if (!group) return fail("Turma não encontrada nesta escola.");
      if (!group.isActive) return fail("Esta turma está inativa.");

      const student = await tx.student.findFirst({
        where: { id: studentId, deletedAt: null, status: "active" },
        include: {
          consents: { where: { purposeCode: "enrollment" }, orderBy: { grantedAt: "desc" } },
          enrollments: {
            where: { deletedAt: null, status: { in: ["active", "draft", "waitlist"] } },
            include: { classGroup: { select: { id: true, name: true } } },
          },
        },
      });
      if (!student) return fail("Aluno não encontrado ou inativo.");

      const alreadyEnrolled = await tx.enrollment.count({
        where: { classGroupId, studentId, deletedAt: null, status: { in: ["active", "draft", "waitlist"] } },
      });
      const activeCount = await tx.enrollment.count({
        where: { classGroupId, status: "active", deletedAt: null },
      });
      const waitlistCount = await tx.enrollment.count({
        where: { classGroupId, status: "waitlist", deletedAt: null },
      });
      const otherGroup = student.enrollments.find(
        (entry) => entry.status === "active" && entry.classGroupId !== classGroupId,
      );

      const consentStatus = student.consents[0]?.status;
      const consent =
        consentStatus === "granted" ? "granted" : consentStatus === "revoked" ? "revoked" : "missing";
      const decision = decideEnrollment({
        consent,
        capacity: group.capacity,
        activeCount,
        waitlistCount,
        alreadyEnrolled: alreadyEnrolled > 0,
        activeInAnotherGroup: Boolean(otherGroup),
      });

      // Exceção só existe para a regra de uma turma ativa por aluno (segunda turma).
      const overridable = decision.status === "blocked" && decision.reason === "other_group_active";

      if (decision.status === "blocked") {
        if (!overridable) return fail(BLOCKED_TEXT[decision.reason]);
        if (!validOverrideReason(overrideReason)) {
          return fail(`${BLOCKED_TEXT[decision.reason]} Escreva o motivo abaixo.`);
        }
      }

      const overridden =
        decision.status === "blocked"
          ? resolveOverriddenEnrollment({ capacity: group.capacity, activeCount, waitlistCount })
          : null;
      const status = decision.status === "blocked" ? (overridden?.status ?? "active") : decision.status;
      const position =
        decision.status === "blocked"
          ? (overridden?.position ?? null)
          : decision.status === "waitlist"
            ? decision.position
            : null;

      const enrollment = await tx.enrollment.create({
        data: {
          schoolId: workspace.schoolId,
          studentId,
          classGroupId,
          status,
          startsOn: new Date(),
          waitlistPosition: position,
          overrideReason: decision.status === "blocked" ? overrideReason : null,
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "enrollment.create",
          entity: "enrollment",
          entityId: enrollment.id,
          after: {
            studentId,
            classGroupId,
            status,
            consent,
            override: decision.status === "blocked" ? overrideReason : null,
          },
        },
      });

      const studentName = student.fullName;
      if (status === "active") return ok(`${studentName} matriculado em ${group.name}.`);
      if (status === "draft") {
        return ok(
          `${studentName} entrou como rascunho: o responsável ainda não assinou o termo de matrícula.`,
        );
      }
      return ok(`${studentName} na lista de espera (posição ${position ?? "—"}).`);
    });

    if (result.status === "ok") {
      revalidatePath(`/turmas/${classGroupId}`);
      revalidatePath("/turmas");
      revalidatePath("/alunos");
    }
    return result;
  } catch (error) {
    console.error("[turmas] falha ao matricular", error);
    return fail("Não foi possível matricular agora. Tente novamente.");
  }
}

/** Encerra a matrícula. A vaga volta a aparecer, mas o histórico não é apagado. */
export async function endEnrollment(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await editor();
  if (!context) return fail("Seu perfil não encerra matrícula.");
  const { session, workspace } = context;

  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const classGroupId = String(formData.get("classGroupId") ?? "");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, deletedAt: null },
        include: { student: { select: { fullName: true } } },
      });
      if (!enrollment) return fail("Matrícula não encontrada nesta escola.");
      if (enrollment.status === "cancelled") return fail("Esta matrícula já está cancelada.");

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "cancelled", endsOn: new Date(), waitlistPosition: null },
      });
      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "enrollment.end",
          entity: "enrollment",
          entityId: enrollment.id,
          before: { status: enrollment.status },
          after: { status: "cancelled" },
        },
      });

      return ok(`Matrícula de ${enrollment.student.fullName} encerrada.`);
    });

    if (result.status === "ok") {
      revalidatePath(`/turmas/${classGroupId}`);
      revalidatePath("/turmas");
      revalidatePath("/alunos");
      // A linha sai da tabela junto com o botão; o aviso precisa vir da URL para não piscar e sumir.
      redirect(`/turmas/${classGroupId}?aviso=${encodeURIComponent(result.message ?? "")}`);
    }
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[turmas] falha ao encerrar matrícula", error);
    return fail("Não foi possível encerrar a matrícula agora. Tente novamente.");
  }
}

/** Chama o primeiro da lista de espera quando abriu vaga e o consentimento está em ordem. */
export async function activateWaitlist(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await editor();
  if (!context) return fail("Seu perfil não altera a lista de espera.");
  const { session, workspace } = context;

  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const classGroupId = String(formData.get("classGroupId") ?? "");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, status: "waitlist", deletedAt: null },
        include: {
          student: {
            include: {
              consents: { where: { purposeCode: "enrollment" }, orderBy: { grantedAt: "desc" } },
            },
          },
          classGroup: { select: { capacity: true, name: true } },
        },
      });
      if (!enrollment) return fail("Entrada da lista de espera não encontrada.");

      const consent = enrollment.student.consents[0]?.status;
      if (consent === "revoked") return fail(BLOCKED_TEXT.consent_revoked);

      const activeCount = await tx.enrollment.count({
        where: { classGroupId, status: "active", deletedAt: null },
      });
      if (seatsLeft(enrollment.classGroup.capacity, activeCount) === 0) {
        return fail("A turma continua sem vaga.");
      }

      const nextStatus = consent === "granted" ? "active" : "draft";
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: nextStatus, waitlistPosition: null },
      });
      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "enrollment.activate",
          entity: "enrollment",
          entityId: enrollment.id,
          before: { status: "waitlist" },
          after: { status: nextStatus },
        },
      });

      return ok(
        nextStatus === "active"
          ? `${enrollment.student.fullName} saiu da espera e está matriculado em ${enrollment.classGroup.name}.`
          : `${enrollment.student.fullName} saiu da espera, mas segue em rascunho até o termo do responsável.`,
      );
    });

    if (result.status === "ok") {
      revalidatePath(`/turmas/${classGroupId}`);
      revalidatePath("/turmas");
      redirect(`/turmas/${classGroupId}?aviso=${encodeURIComponent(result.message ?? "")}`);
    }
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[turmas] falha ao ativar lista de espera", error);
    return fail("Não foi possível ativar agora. Tente novamente.");
  }
}

export async function assignTeacher(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await teacherManager();
  if (!context) return fail("Só a administração da escola vincula professor.");
  const { session, workspace } = context;

  const classGroupId = String(formData.get("classGroupId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");
  const isLead = formData.get("isLead") === "on";

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const group = await tx.classGroup.findFirst({ where: { id: classGroupId, deletedAt: null } });
      if (!group) return fail("Turma não encontrada nesta escola.");

      const membership = await tx.membership.findFirst({
        where: { userId: teacherId, role: "teacher" },
        include: { user: { select: { name: true } } },
      });
      if (!membership) return fail("Este usuário não é professor desta escola.");

      const today = new Date();
      const last = await tx.classGroupTeacher.findFirst({
        where: { classGroupId, userId: teacherId },
        orderBy: { fromDate: "desc" },
      });
      if (last && last.toDate === null) return fail(`${membership.user.name} já está nesta turma.`);

      // Reatribuir no mesmo dia colide com a unique (turma, professor, início): reabre o vínculo.
      const sameDay = last?.toDate != null && last.fromDate.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
      if (sameDay) {
        await tx.classGroupTeacher.update({ where: { id: last.id }, data: { toDate: null, isLead } });
      } else {
        await tx.classGroupTeacher.create({
          data: { schoolId: workspace.schoolId, classGroupId, userId: teacherId, isLead, fromDate: today },
        });
      }
      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "class_group.teacher.assign",
          entity: "class_group",
          entityId: classGroupId,
          after: { teacherId, isLead },
        },
      });

      return ok(`${membership.user.name} vinculado a ${group.name}.`);
    });

    if (result.status === "ok") {
      revalidatePath(`/turmas/${classGroupId}`);
      redirect(`/turmas/${classGroupId}?aviso=${encodeURIComponent(result.message ?? "")}`);
    }
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[turmas] falha ao vincular professor", error);
    return fail("Não foi possível vincular o professor agora. Tente novamente.");
  }
}

/** Desvincula sem apagar: `to_date` encerra o período e o histórico de quem deu a aula fica. */
export async function removeTeacher(_prev: TurmaState, formData: FormData): Promise<TurmaState> {
  const context = await teacherManager();
  if (!context) return fail("Só a administração da escola desvincula professor.");
  const { session, workspace } = context;

  const classGroupId = String(formData.get("classGroupId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId }, async (tx) => {
      const link = await tx.classGroupTeacher.findFirst({
        where: { classGroupId, userId: teacherId, toDate: null },
        include: { classGroup: { select: { name: true } } },
      });
      if (!link) return fail("Vínculo ativo não encontrado.");

      await tx.classGroupTeacher.update({ where: { id: link.id }, data: { toDate: new Date() } });
      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "class_group.teacher.remove",
          entity: "class_group",
          entityId: classGroupId,
          after: { teacherId },
        },
      });

      return ok(`Professor desvinculado de ${link.classGroup.name}.`);
    });

    if (result.status === "ok") {
      revalidatePath(`/turmas/${classGroupId}`);
      redirect(`/turmas/${classGroupId}?aviso=${encodeURIComponent(result.message ?? "")}`);
    }
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[turmas] falha ao desvincular professor", error);
    return fail("Não foi possível desvincular agora. Tente novamente.");
  }
}
