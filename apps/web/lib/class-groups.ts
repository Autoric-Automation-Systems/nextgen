import { withTenant } from "@nextgen/db";
import { birthYear, formatSchedule, occupancyPercent, seatsLeft } from "@nextgen/core";

export type ClassGroupRow = {
  id: string;
  name: string;
  schedule: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  capacity: number;
  activeCount: number;
  waitlistCount: number;
  seats: number;
  occupancy: number;
  unitName: string;
  roomName: string | null;
  teachers: string[];
  isActive: boolean;
};

export async function listUnits(ctx: { schoolId: string; userId: string }) {
  return withTenant(ctx, (tx) =>
    tx.unit.findMany({
      where: { deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isPrimary: true },
    }),
  );
}

export async function listClassGroups(
  ctx: { schoolId: string; userId: string },
  options: { teacherId?: string } = {},
): Promise<ClassGroupRow[]> {
  return withTenant(ctx, async (tx) => {
    const groups = await tx.classGroup.findMany({
      where: {
        deletedAt: null,
        // Professor vê só as turmas dele; coordenação e administração veem a escola inteira.
        ...(options.teacherId ? { teachers: { some: { userId: options.teacherId } } } : {}),
      },
      include: { unit: true, room: true },
    });

    const counts = await tx.enrollment.groupBy({
      by: ["classGroupId", "status"],
      where: { deletedAt: null, status: { in: ["active", "waitlist"] } },
      _count: { _all: true },
    });

    const teacherLinks = await tx.classGroupTeacher.findMany({
      where: { classGroupId: { in: groups.map((group) => group.id) }, toDate: null },
      select: { classGroupId: true, userId: true },
    });
    const memberships = await tx.membership.findMany({
      where: { userId: { in: [...new Set(teacherLinks.map((link) => link.userId))] } },
      select: { userId: true, user: { select: { name: true } } },
    });
    const nameByUser = new Map(memberships.map((row) => [row.userId, row.user.name]));

    const teachersByGroup = new Map<string, string[]>();
    for (const link of teacherLinks) {
      const name = nameByUser.get(link.userId);
      if (!name) continue;
      teachersByGroup.set(link.classGroupId, [...(teachersByGroup.get(link.classGroupId) ?? []), name]);
    }

    const activeByGroup = new Map<string, number>();
    const waitlistByGroup = new Map<string, number>();
    for (const count of counts) {
      const map = count.status === "active" ? activeByGroup : waitlistByGroup;
      map.set(count.classGroupId, count._count._all);
    }

    return groups
      .sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name, "pt-BR"),
      )
      .map((group) => {
        const activeCount = activeByGroup.get(group.id) ?? 0;
        return {
          id: group.id,
          name: group.name,
          schedule: formatSchedule(group),
          weekdays: group.weekdays,
          startTime: group.startTime,
          endTime: group.endTime,
          capacity: group.capacity,
          activeCount,
          waitlistCount: waitlistByGroup.get(group.id) ?? 0,
          seats: seatsLeft(group.capacity, activeCount),
          occupancy: occupancyPercent(group.capacity, activeCount),
          unitName: group.unit.name,
          roomName: group.room?.name ?? null,
          teachers: teachersByGroup.get(group.id) ?? [],
          isActive: group.isActive,
        };
      });
  });
}

export type EnrollmentRow = {
  id: string;
  studentId: string;
  studentName: string;
  nickname: string | null;
  birthYear: number;
  status: string;
  guardianNames: string[];
  consent: "granted" | "missing" | "revoked";
  overrideReason: string | null;
  startsOn: Date;
};

export type ClassGroupDetail = {
  id: string;
  name: string;
  schedule: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  capacity: number;
  activeCount: number;
  waitlistCount: number;
  seats: number;
  occupancy: number;
  unitName: string;
  roomName: string | null;
  teachers: { id: string; name: string }[];
  isActive: boolean;
  roster: EnrollmentRow[];
  waitlist: EnrollmentRow[];
};

export async function getClassGroup(
  ctx: { schoolId: string; userId: string },
  classGroupId: string,
  options: { teacherId?: string } = {},
): Promise<ClassGroupDetail | null> {
  return withTenant(ctx, async (tx) => {
    const group = await tx.classGroup.findFirst({
      where: {
        id: classGroupId,
        deletedAt: null,
        ...(options.teacherId ? { teachers: { some: { userId: options.teacherId } } } : {}),
      },
      include: {
        unit: true,
        room: true,
        enrollments: {
          where: { deletedAt: null, status: { in: ["active", "draft", "waitlist"] } },
          orderBy: { createdAt: "asc" },
          include: {
            student: {
              include: {
                guardians: { include: { guardian: { include: { user: { select: { name: true } } } } } },
                consents: { where: { purposeCode: "enrollment" }, orderBy: { grantedAt: "desc" } },
              },
            },
          },
        },
      },
    });
    if (!group) return null;

    const teacherLinks = await tx.classGroupTeacher.findMany({
      where: { classGroupId: group.id, toDate: null },
      select: { userId: true },
    });
    const memberships = await tx.membership.findMany({
      where: { userId: { in: teacherLinks.map((link) => link.userId) } },
      select: { userId: true, user: { select: { name: true } } },
    });

    const rows: EnrollmentRow[] = group.enrollments.map((enrollment) => {
      const consent = enrollment.student.consents[0];
      return {
        id: enrollment.id,
        studentId: enrollment.studentId,
        studentName: enrollment.student.fullName,
        nickname: enrollment.student.nickname,
        birthYear: birthYear(enrollment.student.birthDate),
        status: enrollment.status,
        guardianNames: enrollment.student.guardians.map((link) => link.guardian.user.name),
        consent:
          consent?.status === "granted" ? "granted" : consent?.status === "revoked" ? "revoked" : "missing",
        overrideReason: enrollment.overrideReason,
        startsOn: enrollment.startsOn,
      };
    });

    const roster = rows.filter((row) => row.status !== "waitlist");
    const waitlist = rows.filter((row) => row.status === "waitlist");
    const activeCount = roster.filter((row) => row.status === "active").length;

    return {
      id: group.id,
      name: group.name,
      schedule: formatSchedule(group),
      weekdays: group.weekdays,
      startTime: group.startTime,
      endTime: group.endTime,
      capacity: group.capacity,
      activeCount,
      waitlistCount: waitlist.length,
      seats: seatsLeft(group.capacity, activeCount),
      occupancy: occupancyPercent(group.capacity, activeCount),
      unitName: group.unit.name,
      roomName: group.room?.name ?? null,
      teachers: memberships.map((row) => ({ id: row.userId, name: row.user.name })),
      isActive: group.isActive,
      roster,
      waitlist,
    };
  });
}

/** Professores da escola para vincular à turma. */
export async function listTeacherOptions(ctx: { schoolId: string; userId: string }) {
  return withTenant(ctx, async (tx) => {
    const memberships = await tx.membership.findMany({
      where: { role: "teacher" },
      select: { userId: true, user: { select: { name: true } } },
    });
    return memberships
      .map((row) => ({ id: row.userId, name: row.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  });
}

export type CandidateStudent = {
  id: string;
  name: string;
  birthYear: number;
  currentGroup: string | null;
  consent: "granted" | "missing" | "revoked";
};

/** Alunos ativos que ainda não estão nesta turma. */
export async function listCandidateStudents(
  ctx: { schoolId: string; userId: string },
  classGroupId: string,
): Promise<CandidateStudent[]> {
  return withTenant(ctx, async (tx) => {
    const group = await tx.classGroup.findFirst({
      where: { id: classGroupId, deletedAt: null },
      select: { id: true },
    });
    if (!group) return [];

    const students = await tx.student.findMany({
      where: { deletedAt: null, status: "active" },
      orderBy: { fullName: "asc" },
      include: {
        enrollments: {
          where: { deletedAt: null, status: { in: ["active", "draft", "waitlist"] } },
          include: { classGroup: { select: { id: true, name: true } } },
        },
        consents: { where: { purposeCode: "enrollment" }, orderBy: { grantedAt: "desc" } },
      },
    });

    return students
      .filter((student) => !student.enrollments.some((entry) => entry.classGroupId === classGroupId))
      .map((student) => {
        const current = student.enrollments.find((entry) => entry.status === "active");
        const consentStatus = student.consents[0]?.status;
        const year = birthYear(student.birthDate);

        return {
          id: student.id,
          name: student.fullName,
          birthYear: year,
          currentGroup: current?.classGroup.name ?? null,
          consent:
            consentStatus === "granted"
              ? ("granted" as const)
              : consentStatus === "revoked"
                ? ("revoked" as const)
                : ("missing" as const),
        };
      });
  });
}
