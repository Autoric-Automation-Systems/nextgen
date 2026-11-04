import { describe, expect, it, afterAll } from "vitest";
import { prisma, withTenant, withoutTenant } from "../src/index";

const DEMO = "01930000-0000-7000-8000-000000000001";
const RIVAL = "01930000-0000-7000-8000-000000000002";
const RIVAL_STUDENT = "01930000-0000-7000-8000-000000000402";
const DEMO_STUDENT = "01930000-0000-7000-8000-000000000301";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("RLS: isolamento entre escolas", () => {
  it("o papel de runtime não é superusuário nem tem BYPASSRLS", async () => {
    const [row] = await prisma.$queryRaw<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
      select current_user, rolsuper, rolbypassrls from pg_roles where rolname = current_user
    `;
    expect(row?.rolsuper).toBe(false);
    expect(row?.rolbypassrls).toBe(false);
  });

  it("sem contexto de tenant, não retorna nenhuma linha", async () => {
    const students = await withoutTenant((tx) => tx.student.findMany());
    expect(students).toHaveLength(0);
  });

  it("com contexto da escola A, vê só alunos da escola A", async () => {
    const students = await withTenant({ schoolId: DEMO }, (tx) => tx.student.findMany());
    expect(students.length).toBeGreaterThan(0);
    expect(students.every((s) => s.schoolId === DEMO)).toBe(true);
    expect(students.map((s) => s.id)).not.toContain(RIVAL_STUDENT);
  });

  it("com contexto da escola B, não vê aluno da escola A", async () => {
    const students = await withTenant({ schoolId: RIVAL }, (tx) => tx.student.findMany());
    expect(students.map((s) => s.id)).toContain(RIVAL_STUDENT);
    expect(students.map((s) => s.id)).not.toContain(DEMO_STUDENT);
  });

  it("busca por id de outra escola devolve null", async () => {
    const stolen = await withTenant({ schoolId: RIVAL }, (tx) =>
      tx.student.findUnique({ where: { id: DEMO_STUDENT } }),
    );
    expect(stolen).toBeNull();
  });

  it("insert com school_id de outra escola é bloqueado pelo WITH CHECK", async () => {
    await expect(
      withTenant({ schoolId: RIVAL }, (tx) =>
        tx.student.create({
          data: {
            schoolId: DEMO,
            fullName: "Invasor",
            birthDate: new Date("2016-01-01"),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("update de aluno de outra escola não afeta linha alguma", async () => {
    const result = await withTenant({ schoolId: RIVAL }, (tx) =>
      tx.student.updateMany({ where: { id: DEMO_STUDENT }, data: { nickname: "sequestrado" } }),
    );
    expect(result.count).toBe(0);

    const original = await withTenant({ schoolId: DEMO }, (tx) =>
      tx.student.findUnique({ where: { id: DEMO_STUDENT } }),
    );
    expect(original?.nickname).not.toBe("sequestrado");
  });

  it("schools também é isolada", async () => {
    const schools = await withTenant({ schoolId: DEMO }, (tx) => tx.school.findMany());
    expect(schools.map((s) => s.id)).toEqual([DEMO]);
  });

  it("consentimento não pode ser alterado além de status e revogação", async () => {
    const consent = await withTenant({ schoolId: DEMO }, (tx) => tx.consent.findFirst());
    expect(consent).not.toBeNull();

    await expect(
      withTenant({ schoolId: DEMO }, (tx) =>
        tx.consent.update({
          where: { id: consent!.id },
          data: { evidenceHash: "adulterado" },
        }),
      ),
    ).rejects.toThrow(/imutável/);

    const revoked = await withTenant({ schoolId: DEMO }, (tx) =>
      tx.consent.update({
        where: { id: consent!.id },
        data: { status: "revoked", revokedAt: new Date() },
      }),
    );
    expect(revoked.status).toBe("revoked");
  });

  it("auditoria é append-only para o papel de aplicação", async () => {
    await expect(prisma.$executeRaw`delete from audit_logs`).rejects.toThrow();
  });

  it("users só é visível para quem compartilha a escola (papel de aplicação)", async () => {
    const rivalUsers = await withTenant(
      { schoolId: RIVAL, userId: "01930000-0000-7000-8000-000000000401" },
      (tx) => tx.user.findMany({ select: { email: true } }),
    );

    expect(rivalUsers.map((u) => u.email)).toContain("admin@rival.test");
    expect(rivalUsers.map((u) => u.email)).not.toContain("admin@demo.test");
  });

  it("guardian só enxerga a própria linha antes de haver contexto de escola", async () => {
    const guardianUserId = "01930000-0000-7000-8000-000000000203";
    const rows = await withoutTenant(async (tx) => {
      await tx.$executeRaw`select set_config('app.user_id', ${guardianUserId}, true)`;
      return tx.guardian.findMany();
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(guardianUserId);
  });
});
