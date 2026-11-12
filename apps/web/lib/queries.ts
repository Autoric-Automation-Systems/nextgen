import { withTenant } from "@nextgen/db";
import { ageOn, canPublishPublicCard, type AgeRegime, ageRegime, type Score } from "@nextgen/core";

export type StudentRow = {
  id: string;
  name: string;
  nickname: string | null;
  age: number;
  regime: AgeRegime;
  classGroup: string | null;
  guardianNames: string[];
  consent: "granted" | "missing" | "revoked";
  publicCard: boolean;
};

/**
 * Toda leitura passa por `withTenant`. Se alguém esquecer, a RLS devolve zero linhas
 * em vez de vazar dado de outra escola.
 */
export async function listStudents(ctx: {
  schoolId: string;
  userId: string;
  /**
   * Recorte por família. A RLS isola escola, não papel: sem esta lista, o responsável
   * leria o cadastro de todos os alunos da escola.
   */
  studentIds?: string[];
}): Promise<StudentRow[]> {
  const today = new Date();
  if (ctx.studentIds && ctx.studentIds.length === 0) return [];

  return withTenant(ctx, async (tx) => {
    const students = await tx.student.findMany({
      where: { deletedAt: null, ...(ctx.studentIds ? { id: { in: ctx.studentIds } } : {}) },
      orderBy: { fullName: "asc" },
      include: {
        guardians: { include: { guardian: { include: { user: true } } } },
        enrollments: {
          where: { deletedAt: null },
          include: { classGroup: { select: { id: true, name: true } } },
        },
        consents: { where: { purposeCode: { in: ["enrollment", "image_public"] } } },
      },
    });

    return students.map((student) => {
      const age = ageOn(student.birthDate, today);
      const enrollment = student.enrollments.find((e) => e.status === "active") ?? student.enrollments[0];
      const enrollmentConsent = student.consents.find((c) => c.purposeCode === "enrollment");
      const imageConsent = student.consents.find((c) => c.purposeCode === "image_public");

      const consent: StudentRow["consent"] =
        enrollmentConsent?.status === "granted"
          ? "granted"
          : enrollmentConsent?.status === "revoked"
            ? "revoked"
            : "missing";

      const publicCard =
        canPublishPublicCard({
          age,
          optedIn: student.publicCardEnabled,
          imagePublicConsent: imageConsent?.status ?? "missing",
        }).allowed === true;

      return {
        id: student.id,
        name: student.fullName,
        nickname: student.nickname,
        age,
        regime: ageRegime(age),
        classGroup: enrollment?.classGroup.name ?? null,
        guardianNames: student.guardians.map((link) => link.guardian.user.name),
        consent,
        publicCard,
      };
    });
  });
}

export type SchoolOverview = {
  students: number;
  teachers: number;
  classGroups: number;
  pendingConsents: number;
  /** Ocupação por turma: é o quadro que a coordenação olha todo dia. */
  groups: { id: string; name: string; students: number; capacity: number }[];
};

export async function getOverview(ctx: { schoolId: string; userId: string }): Promise<SchoolOverview> {
  return withTenant(ctx, async (tx) => {
    const [activeStudents, teachers, groups, consents, enrollments] = await Promise.all([
      tx.student.findMany({ where: { deletedAt: null, status: "active" }, select: { id: true } }),
      tx.membership.count({ where: { role: "teacher", status: "active" } }),
      tx.classGroup.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, capacity: true },
      }),
      tx.consent.findMany({ where: { purposeCode: "enrollment" }, select: { studentId: true } }),
      tx.enrollment.findMany({
        where: { deletedAt: null, status: "active" },
        select: { classGroupId: true },
      }),
    ]);

    const withConsent = new Set(consents.map((c) => c.studentId));
    const perGroup = new Map<string, number>();
    for (const enrollment of enrollments) {
      perGroup.set(enrollment.classGroupId, (perGroup.get(enrollment.classGroupId) ?? 0) + 1);
    }

    return {
      students: activeStudents.length,
      teachers,
      classGroups: groups.length,
      pendingConsents: activeStudents.filter((student) => !withConsent.has(student.id)).length,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        students: perGroup.get(group.id) ?? 0,
        capacity: group.capacity,
      })),
    };
  });
}

export type StudentCard = {
  id: string;
  nickname: string;
  fullName: string;
  age: number;
  /** Nome da turma ativa; a escola escolhe o rótulo. */
  classGroup: string | null;
  position: string | null;
  jerseyNumber: number | null;
  guardianNames: string[];
  cycleLabel: string;
  scores: Score[];
  previousScores: Score[];
  consent: "granted" | "missing" | "revoked";
  publicCard: { allowed: boolean; reason?: string };
  imageConsent: "granted" | "missing" | "revoked";
};

/**
 * Card de um aluno, com o ciclo atual e o anterior.
 *
 * "Ciclo atual" é o `cycle_label` lançado mais recentemente — não o maior nome, porque
 * ciclo renomeado ("T4" → "4º tri") quebraria a ordenação alfabética.
 */
export async function getStudentCard(
  ctx: { schoolId: string; userId: string },
  studentId: string,
): Promise<StudentCard | null> {
  return withTenant(ctx, async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: {
        guardians: { include: { guardian: { include: { user: true } } } },
        enrollments: {
          where: { deletedAt: null },
          include: { classGroup: { select: { id: true, name: true } } },
        },
        consents: { where: { purposeCode: { in: ["enrollment", "image_public", "public_card"] } } },
        skillRatings: { orderBy: { ratedAt: "desc" } },
      },
    });

    if (!student) return null;

    const age = ageOn(student.birthDate, new Date());
    const enrollment = student.enrollments.find((entry) => entry.status === "active") ?? student.enrollments[0];

    const cycles: string[] = [];
    for (const rating of student.skillRatings) {
      if (!cycles.includes(rating.cycleLabel)) cycles.push(rating.cycleLabel);
    }
    const [currentCycle = "—", previousCycle] = cycles;

    const scores = student.skillRatings
      .filter((rating) => rating.cycleLabel === currentCycle)
      .map((rating) => ({ code: rating.code, score: rating.score }));
    const previousScores = previousCycle
      ? student.skillRatings
          .filter((rating) => rating.cycleLabel === previousCycle)
          .map((rating) => ({ code: rating.code, score: rating.score }))
      : [];

    const enrollmentConsent = student.consents.find((entry) => entry.purposeCode === "enrollment");
    const imageConsent = student.consents.find((entry) => entry.purposeCode === "image_public");

    const imageStatus: StudentCard["imageConsent"] =
      imageConsent?.status === "granted"
        ? "granted"
        : imageConsent?.status === "revoked"
          ? "revoked"
          : "missing";

    const consent: StudentCard["consent"] =
      enrollmentConsent?.status === "granted" ? "granted" : enrollmentConsent?.status === "revoked" ? "revoked" : "missing";

    const publicCard = canPublishPublicCard({
      age,
      optedIn: student.publicCardEnabled,
      imagePublicConsent: imageStatus,
    });

    return {
      id: student.id,
      nickname: student.nickname ?? student.fullName.split(" ")[0]!,
      fullName: student.fullName,
      age,
      classGroup: enrollment?.classGroup.name ?? null,
      position: student.position,
      jerseyNumber: student.jerseyNumber,
      guardianNames: student.guardians.map((link) => link.guardian.user.name),
      cycleLabel: currentCycle,
      scores,
      previousScores,
      consent,
      publicCard: { allowed: publicCard.allowed, reason: publicCard.reason },
      imageConsent: imageStatus,
    };
  });
}
