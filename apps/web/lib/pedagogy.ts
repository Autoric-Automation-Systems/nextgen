import { withTenant } from "@nextgen/db";
import type { MaterialKind } from "./pedagogy-rules";

/**
 * Consultas da biblioteca pedagógica e dos planos de aula.
 *
 * Toda leitura passa por `withTenant`, então a RLS já limita à escola da sessão. O que
 * esta camada acrescenta é o recorte por papel: responsável não entra na biblioteca
 * interna, e professor só vê plano das turmas dele.
 */

export type MaterialView = {
  id: string;
  kind: MaterialKind;
  title: string;
  description: string | null;
  bodyText: string | null;
  url: string | null;
  hasFile: boolean;
  mime: string | null;
  sizeBytes: number | null;
  isPublished: boolean;
  position: number;
};

export type ChapterView = {
  id: string;
  title: string;
  summary: string | null;
  position: number;
  materials: MaterialView[];
};

export type SubjectSummary = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  isActive: boolean;
  chapterCount: number;
  materialCount: number;
  publishedCount: number;
};

export type SubjectDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  chapters: ChapterView[];
};

function toMaterialView(material: {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  bodyText: string | null;
  url: string | null;
  storagePath: string | null;
  mime: string | null;
  sizeBytes: number | null;
  isPublished: boolean;
  position: number;
}): MaterialView {
  return {
    id: material.id,
    kind: material.kind as MaterialKind,
    title: material.title,
    description: material.description,
    bodyText: material.bodyText,
    url: material.url,
    hasFile: Boolean(material.storagePath),
    mime: material.mime,
    sizeBytes: material.sizeBytes,
    isPublished: material.isPublished,
    position: material.position,
  };
}

export async function listSubjects(ctx: { schoolId: string; userId?: string }): Promise<SubjectSummary[]> {
  return withTenant(ctx, async (tx) => {
    const subjects = await tx.subject.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        chapters: {
          where: { deletedAt: null },
          select: { id: true, _count: { select: { materials: true } } },
        },
      },
    });

    const published = await tx.material.groupBy({
      by: ["chapterId"],
      where: { deletedAt: null, isPublished: true },
      _count: { _all: true },
    });
    const publishedByChapter = new Map(published.map((row) => [row.chapterId, row._count._all]));

    return subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      description: subject.description,
      position: subject.position,
      isActive: subject.isActive,
      chapterCount: subject.chapters.length,
      materialCount: subject.chapters.reduce((total, chapter) => total + chapter._count.materials, 0),
      publishedCount: subject.chapters.reduce(
        (total, chapter) => total + (publishedByChapter.get(chapter.id) ?? 0),
        0,
      ),
    }));
  });
}

export async function getSubject(
  ctx: { schoolId: string; userId?: string },
  subjectId: string,
): Promise<SubjectDetail | null> {
  return withTenant(ctx, async (tx) => {
    const subject = await tx.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
      include: {
        chapters: {
          where: { deletedAt: null },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            materials: {
              where: { deletedAt: null },
              orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });

    if (!subject) return null;

    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      isActive: subject.isActive,
      chapters: subject.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        summary: chapter.summary,
        position: chapter.position,
        materials: chapter.materials.map(toMaterialView),
      })),
    };
  });
}

export type LessonPlanRow = {
  id: string;
  title: string;
  plannedFor: Date;
  durationMinutes: number;
  objective: string | null;
  warmup: string | null;
  mainPart: string | null;
  gamePart: string | null;
  cooldown: string | null;
  notes: string | null;
  classGroupId: string;
  classGroupName: string;
  authorName: string;
  materialCount: number;
};

export async function listLessonPlans(
  ctx: { schoolId: string; userId?: string },
  options: { teacherId?: string; classGroupId?: string } = {},
): Promise<LessonPlanRow[]> {
  return withTenant(ctx, async (tx) => {
    const plans = await tx.lessonPlan.findMany({
      where: {
        deletedAt: null,
        ...(options.classGroupId ? { classGroupId: options.classGroupId } : {}),
        // Professor só enxerga o plano das turmas em que dá aula.
        ...(options.teacherId
          ? { classGroup: { teachers: { some: { userId: options.teacherId, toDate: null } } } }
          : {}),
      },
      orderBy: [{ plannedFor: "desc" }, { createdAt: "desc" }],
      include: {
        classGroup: { select: { id: true, name: true } },
        _count: { select: { materials: true } },
      },
    });

    const authorIds = [...new Set(plans.map((plan) => plan.authorUserId))];
    const authors = await tx.membership.findMany({
      where: { userId: { in: authorIds } },
      select: { userId: true, user: { select: { name: true } } },
    });
    const nameByUser = new Map(authors.map((row) => [row.userId, row.user.name]));

    return plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      plannedFor: plan.plannedFor,
      durationMinutes: plan.durationMinutes,
      objective: plan.objective,
      warmup: plan.warmup,
      mainPart: plan.mainPart,
      gamePart: plan.gamePart,
      cooldown: plan.cooldown,
      notes: plan.notes,
      classGroupId: plan.classGroup.id,
      classGroupName: plan.classGroup.name,
      authorName: nameByUser.get(plan.authorUserId) ?? "—",
      materialCount: plan._count.materials,
    }));
  });
}

/** Turmas onde o usuário pode escrever plano: as dele (professor) ou todas (coordenação). */
export async function listLessonPlanClasses(
  ctx: { schoolId: string; userId?: string },
  options: { teacherId?: string } = {},
): Promise<{ id: string; name: string }[]> {
  return withTenant(ctx, (tx) =>
    tx.classGroup.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(options.teacherId ? { teachers: { some: { userId: options.teacherId, toDate: null } } } : {}),
      },
      orderBy: [{ startTime: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  );
}
