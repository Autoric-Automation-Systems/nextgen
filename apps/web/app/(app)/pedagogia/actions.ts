"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@nextgen/db";
import { requireSession } from "@/lib/session";
import { resolveWorkspace, type Workspace } from "@/lib/workspace";
import {
  MATERIAL_KINDS,
  durationIssue,
  materialDraftIssue,
  nextPosition,
  parseDateInput,
  type MaterialKind,
} from "@/lib/pedagogy-rules";

export type PedagogyState = { status: "idle" | "ok" | "error"; message?: string };

const ok = (message: string): PedagogyState => ({ status: "ok", message });
const fail = (message: string): PedagogyState => ({ status: "error", message });

async function writer(action: "content:structure" | "content:write"): Promise<{
  session: Awaited<ReturnType<typeof requireSession>>;
  workspace: Workspace;
} | null> {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can(action)) return null;
  return { session, workspace };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value ? value : null;
}

export async function createSubject(_prev: PedagogyState, formData: FormData): Promise<PedagogyState> {
  const context = await writer("content:structure");
  if (!context) return fail("Só a coordenação cria matéria.");
  const { session, workspace } = context;

  const name = text(formData, "name");
  const description = optional(formData, "description");
  if (!name) return fail("Dê um nome à matéria.");
  if (name.length > 60) return fail("O nome da matéria cabe em 60 caracteres.");

  try {
    const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
      const last = await tx.subject.findFirst({
        where: { deletedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      const subject = await tx.subject.create({
        data: {
          schoolId: workspace.schoolId,
          name,
          description,
          position: nextPosition(last ? [last.position] : []),
        },
      });

      await tx.auditLog.create({
        data: {
          schoolId: workspace.schoolId,
          actorUserId: session.userId,
          actorRole: workspace.role,
          action: "subject.create",
          entity: "subject",
          entityId: subject.id,
          after: { name, description },
        },
      });

      return ok(`Matéria ${name} criada.`);
    });
    revalidatePath("/pedagogia");
    return result;
  } catch (error) {
    if (String(error).includes("subjects_school_id_name_key")) {
      return fail("Já existe uma matéria com esse nome.");
    }
    throw error;
  }
}

export async function createChapter(_prev: PedagogyState, formData: FormData): Promise<PedagogyState> {
  const context = await writer("content:structure");
  if (!context) return fail("Só a coordenação cria capítulo.");
  const { session, workspace } = context;

  const subjectId = text(formData, "subjectId");
  const title = text(formData, "title");
  const summary = optional(formData, "summary");
  if (!subjectId) return fail("Capítulo precisa de uma matéria.");
  if (!title) return fail("Dê um título ao capítulo.");
  if (title.length > 120) return fail("O título do capítulo cabe em 120 caracteres.");

  const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const subject = await tx.subject.findFirst({ where: { id: subjectId, deletedAt: null } });
    if (!subject) return fail("Matéria não encontrada nesta escola.");

    const last = await tx.chapter.findFirst({
      where: { subjectId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const chapter = await tx.chapter.create({
      data: {
        schoolId: workspace.schoolId,
        subjectId,
        title,
        summary,
        position: nextPosition(last ? [last.position] : []),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: "chapter.create",
        entity: "chapter",
        entityId: chapter.id,
        after: { subjectId, title },
      },
    });

    return ok(`Capítulo ${title} criado.`);
  });

  revalidatePath("/pedagogia");
  revalidatePath(`/pedagogia/${subjectId}`);
  return result;
}

export async function createMaterial(_prev: PedagogyState, formData: FormData): Promise<PedagogyState> {
  const context = await writer("content:write");
  if (!context) return fail("Seu perfil não alimenta a biblioteca.");
  const { session, workspace } = context;

  const chapterId = text(formData, "chapterId");
  const rawKind = text(formData, "kind");
  if (!chapterId) return fail("Conteúdo precisa de um capítulo.");
  if (!(MATERIAL_KINDS as readonly string[]).includes(rawKind)) return fail("Tipo de conteúdo desconhecido.");
  const kind = rawKind as MaterialKind;

  const title = text(formData, "title");
  const sizeBytes = Number(formData.get("sizeBytes") ?? 0);

  const draft = {
    kind,
    title,
    description: optional(formData, "description"),
    bodyText: kind === "text" ? String(formData.get("bodyText") ?? "") : null,
    url: kind === "link" ? text(formData, "url") : null,
    storagePath: kind === "text" || kind === "link" ? null : text(formData, "storagePath"),
    mime: kind === "text" || kind === "link" ? null : text(formData, "mime"),
    sizeBytes,
  };

  const issue = materialDraftIssue(draft);
  if (issue) return fail(issue);

  const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const chapter = await tx.chapter.findFirst({
      where: { id: chapterId, deletedAt: null },
      include: { subject: { select: { id: true } } },
    });
    if (!chapter) return { state: fail("Capítulo não encontrado nesta escola."), subjectId: null };

    const last = await tx.material.findFirst({
      where: { chapterId, deletedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const material = await tx.material.create({
      data: {
        schoolId: workspace.schoolId,
        chapterId,
        kind,
        title: draft.title.trim(),
        description: draft.description,
        bodyText: draft.bodyText,
        url: draft.url,
        storagePath: draft.storagePath,
        mime: draft.mime,
        sizeBytes: kind === "text" || kind === "link" ? null : sizeBytes,
        position: nextPosition(last ? [last.position] : []),
        isPublished: false,
        createdById: session.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: "material.create",
        entity: "material",
        entityId: material.id,
        after: { chapterId, kind, title: draft.title.trim() },
      },
    });

    return { state: ok(`Conteúdo ${draft.title.trim()} adicionado.`), subjectId: chapter.subject.id };
  });

  if (result.subjectId) {
    revalidatePath("/pedagogia");
    revalidatePath(`/pedagogia/${result.subjectId}`);
  }
  return result.state;
}

/** Publicar é o que torna o conteúdo visível para a família; rascunho fica na equipe. */
export async function setMaterialPublished(formData: FormData): Promise<void> {
  const context = await writer("content:write");
  if (!context) return;
  const { session, workspace } = context;

  const materialId = text(formData, "materialId");
  const publish = text(formData, "publish") === "1";
  if (!materialId) return;

  const subjectId = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const material = await tx.material.findFirst({
      where: { id: materialId, deletedAt: null },
      include: { chapter: { select: { subjectId: true } } },
    });
    if (!material) return null;

    await tx.material.update({ where: { id: materialId }, data: { isPublished: publish } });
    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: publish ? "material.publish" : "material.unpublish",
        entity: "material",
        entityId: materialId,
        after: { isPublished: publish },
      },
    });

    return material.chapter.subjectId;
  });

  if (!subjectId) return;
  revalidatePath("/pedagogia");
  revalidatePath(`/pedagogia/${subjectId}`);
}

/**
 * Arquivar, não apagar: o material pode estar citado em plano de aula e no histórico da
 * turma. A linha sai das telas e o arquivo continua onde está.
 */
export async function archiveMaterial(formData: FormData): Promise<void> {
  const context = await writer("content:write");
  if (!context) return;
  const { session, workspace } = context;

  const materialId = text(formData, "materialId");
  if (!materialId) return;

  const subjectId = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const material = await tx.material.findFirst({
      where: { id: materialId, deletedAt: null },
      include: { chapter: { select: { subjectId: true } } },
    });
    if (!material) return null;

    await tx.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date(), isPublished: false },
    });
    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: "material.archive",
        entity: "material",
        entityId: materialId,
        before: { title: material.title, kind: material.kind },
      },
    });

    return material.chapter.subjectId;
  });

  if (!subjectId) return;
  revalidatePath("/pedagogia");
  revalidatePath(`/pedagogia/${subjectId}`);
}

export async function createLessonPlan(_prev: PedagogyState, formData: FormData): Promise<PedagogyState> {
  const context = await writer("content:write");
  if (!context) return fail("Seu perfil não cria plano de aula.");
  const { session, workspace } = context;

  const classGroupId = text(formData, "classGroupId");
  const title = text(formData, "title");
  const plannedFor = parseDateInput(text(formData, "plannedFor"));
  const durationMinutes = Number(formData.get("durationMinutes") ?? 60);

  if (!classGroupId) return fail("Escolha a turma do plano.");
  if (!title) return fail("Dê um título ao plano.");
  if (title.length > 120) return fail("O título do plano cabe em 120 caracteres.");
  if (!plannedFor) return fail("Informe a data da aula.");

  const duration = durationIssue(durationMinutes);
  if (duration) return fail(duration);

  const result = await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const group = await tx.classGroup.findFirst({
      where: { id: classGroupId, deletedAt: null, isActive: true },
      include: { teachers: { where: { toDate: null }, select: { userId: true } } },
    });
    if (!group) return fail("Turma não encontrada nesta escola.");

    // A RLS isola escola, não turma: o professor só planeja onde realmente dá aula.
    if (workspace.role === "teacher" && !group.teachers.some((teacher) => teacher.userId === session.userId)) {
      return fail("Você só cria plano das suas turmas.");
    }

    const plan = await tx.lessonPlan.create({
      data: {
        schoolId: workspace.schoolId,
        classGroupId,
        authorUserId: session.userId,
        title: title.trim(),
        plannedFor,
        durationMinutes,
        objective: optional(formData, "objective"),
        warmup: optional(formData, "warmup"),
        mainPart: optional(formData, "mainPart"),
        gamePart: optional(formData, "gamePart"),
        cooldown: optional(formData, "cooldown"),
        notes: optional(formData, "notes"),
      },
    });

    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: "lesson_plan.create",
        entity: "lesson_plan",
        entityId: plan.id,
        after: {
          classGroupId,
          title: title.trim(),
          plannedFor: plannedFor.toISOString().slice(0, 10),
        },
      },
    });

    return ok(`Plano ${title.trim()} criado para ${group.name}.`);
  });

  revalidatePath("/aulas");
  return result;
}

export async function archiveLessonPlan(formData: FormData): Promise<void> {
  const context = await writer("content:write");
  if (!context) return;
  const { session, workspace } = context;

  const planId = text(formData, "planId");
  if (!planId) return;

  await withTenant({ schoolId: workspace.schoolId, userId: session.userId }, async (tx) => {
    const plan = await tx.lessonPlan.findFirst({ where: { id: planId, deletedAt: null } });
    if (!plan) return;

    // Coordenação arquiva qualquer plano; professor só o próprio.
    if (workspace.role === "teacher" && plan.authorUserId !== session.userId) return;

    await tx.lessonPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        schoolId: workspace.schoolId,
        actorUserId: session.userId,
        actorRole: workspace.role,
        action: "lesson_plan.archive",
        entity: "lesson_plan",
        entityId: planId,
      },
    });
  });

  revalidatePath("/aulas");
}
