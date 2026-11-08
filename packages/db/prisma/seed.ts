/**
 * Seed de desenvolvimento: duas escolas completas, para que o teste de isolamento
 * tenha o que isolar. Roda com o papel dono (DATABASE_URL), mas a RLS é forçada
 * também para o dono — por isso cada escrita abre o contexto da escola.
 */
import { randomUUID, createHash } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { createAdminClient } from "../src/client";

const db = createAdminClient();

/**
 * Senha das contas de demonstração. Existe para o ambiente local abrir o painel sem
 * depender de e-mail: o login é e-mail + senha, e conta sem credencial só entra pelo
 * fluxo de "esqueci a senha".
 */
const DEMO_PASSWORD = "demo12345678";

const schoolDemo = "01930000-0000-7000-8000-000000000001";
const schoolRival = "01930000-0000-7000-8000-000000000002";

const ids = {
  unitDemo: "01930000-0000-7000-8000-000000000101",
  roomDemo: "01930000-0000-7000-8000-000000000102",
  seasonDemo: "01930000-0000-7000-8000-000000000103",
  catSub8: "01930000-0000-7000-8000-000000000104",
  catSub9: "01930000-0000-7000-8000-000000000105",
  catSub11: "01930000-0000-7000-8000-000000000106",
  groupSub8: "01930000-0000-7000-8000-000000000107",
  adminUser: "01930000-0000-7000-8000-000000000201",
  teacherUser: "01930000-0000-7000-8000-000000000202",
  guardianUser: "01930000-0000-7000-8000-000000000203",
  guardian: "01930000-0000-7000-8000-000000000204",
  studentA: "01930000-0000-7000-8000-000000000301",
  studentB: "01930000-0000-7000-8000-000000000302",
  studentC: "01930000-0000-7000-8000-000000000303",
  rivalUser: "01930000-0000-7000-8000-000000000401",
  rivalStudent: "01930000-0000-7000-8000-000000000402",
};

const PURPOSES = [
  { code: "enrollment", name: "Matrícula e execução do contrato", required: true, sensitive: false },
  { code: "image_internal", name: "Uso interno de imagem", required: false, sensitive: false },
  { code: "image_public", name: "Divulgação de imagem em marketing", required: false, sensitive: false },
  { code: "public_card", name: "Perfil público do aluno", required: false, sensitive: false },
  { code: "health_anamnesis", name: "Anamnese e prontuário", required: false, sensitive: true },
  { code: "health_emergency", name: "Kit de emergência", required: false, sensitive: true },
  { code: "marketing", name: "Comunicações de marketing", required: false, sensitive: false },
];

async function inSchool<T>(schoolId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.school_id', ${schoolId}, true)`;
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    return fn();
  });
}

async function main() {
  for (const p of PURPOSES) {
    await db.consentPurpose.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        description: p.name,
        isRequired: p.required,
        isSensitive: p.sensitive,
      },
    });

    const body = `# Termo de consentimento — ${p.name}\n\nVersão 1.0.`;
    await db.consentTerm.upsert({
      where: { purposeCode_version: { purposeCode: p.code, version: "1.0" } },
      update: {},
      create: {
        purposeCode: p.code,
        version: "1.0",
        bodyMarkdown: body,
        bodyHash: createHash("sha256").update(body).digest("hex"),
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
  }

  await inSchool(schoolDemo, "", async () => {
    await db.school.upsert({
      where: { id: schoolDemo },
      update: {},
      create: {
        id: schoolDemo,
        slug: "demo",
        legalName: "Escola Demo Futebol Ltda",
        tradeName: "Demo FC",
        status: "active",
        planCode: "escola",
        tagline: "Formar jogador, formar pessoa.",
      },
    });

    await db.unit.upsert({
      where: { id: ids.unitDemo },
      update: {},
      create: {
        id: ids.unitDemo,
        schoolId: schoolDemo,
        name: "Sede Centro",
        address: "Rua das Chuteiras, 100",
        city: "São Paulo",
        state: "SP",
        zip: "01000-000",
        isPrimary: true,
      },
    });

    await db.room.upsert({
      where: { id: ids.roomDemo },
      update: {},
      create: {
        id: ids.roomDemo,
        schoolId: schoolDemo,
        unitId: ids.unitDemo,
        name: "Campo 1",
        kind: "field",
        capacity: 24,
      },
    });

    await db.season.upsert({
      where: { id: ids.seasonDemo },
      update: {},
      create: {
        id: ids.seasonDemo,
        schoolId: schoolDemo,
        name: "2026",
        startsOn: new Date("2026-01-15"),
        endsOn: new Date("2026-12-15"),
        isActive: true,
      },
    });

    for (const [id, name, from, to] of [
      [ids.catSub8, "Sub-8", 2018, 2018],
      [ids.catSub9, "Sub-9", 2017, 2017],
      [ids.catSub11, "Sub-11", 2015, 2015],
    ] as const) {
      await db.category.upsert({
        where: { id },
        update: {},
        create: {
          id,
          schoolId: schoolDemo,
          seasonId: ids.seasonDemo,
          name,
          birthYearFrom: from,
          birthYearTo: to,
          sortOrder: from,
        },
      });
    }

    await db.classGroup.upsert({
      where: { id: ids.groupSub8 },
      update: {},
      create: {
        id: ids.groupSub8,
        schoolId: schoolDemo,
        unitId: ids.unitDemo,
        roomId: ids.roomDemo,
        seasonId: ids.seasonDemo,
        categoryId: ids.catSub8,
        name: "Sub-8 — Ter/Qui 17h",
        weekdays: [2, 4],
        startTime: "17:00",
        endTime: "18:00",
        capacity: 20,
      },
    });
  });

  await inSchool(schoolRival, "", async () => {
    await db.school.upsert({
      where: { id: schoolRival },
      update: {},
      create: {
        id: schoolRival,
        slug: "rival",
        legalName: "Rival Futebol Escola Ltda",
        tradeName: "Rival FC",
        status: "active",
        planCode: "campo",
      },
    });
  });

  const users = [
    { id: ids.adminUser, name: "Ana Diretora", email: "admin@demo.test", school: schoolDemo, role: "admin" as const },
    { id: ids.teacherUser, name: "Bruno Professor", email: "professor@demo.test", school: schoolDemo, role: "teacher" as const },
    { id: ids.guardianUser, name: "Carla Responsável", email: "responsavel@demo.test", school: schoolDemo, role: "guardian" as const },
    { id: ids.rivalUser, name: "Davi Rival", email: "admin@rival.test", school: schoolRival, role: "admin" as const },
  ];

  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        phone: "+5511999990000",
        isPlatformStaff: false,
      },
    });

    // Mesmo hash para todas: scrypt é caro de propósito, e gerar quatro vezes só
    // atrasa o seed.
    const passwordHash = await credentialHash();
    await db.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: u.id } },
      update: { password: passwordHash },
      create: {
        userId: u.id,
        providerId: "credential",
        accountId: u.id,
        password: passwordHash,
      },
    });

    await inSchool(u.school, u.id, async () => {
      await db.membership.upsert({
        where: { schoolId_userId: { schoolId: u.school, userId: u.id } },
        update: {},
        create: { schoolId: u.school, userId: u.id, role: u.role, status: "active" },
      });
    });
  }

  await inSchool(schoolDemo, ids.adminUser, async () => {
    await db.guardian.upsert({
      where: { schoolId_userId: { schoolId: schoolDemo, userId: ids.guardianUser } },
      update: {},
      create: {
        id: ids.guardian,
        schoolId: schoolDemo,
        userId: ids.guardianUser,
        cpfLast4: "4321",
        phone: "+5511988887777",
        relationDefault: "mother",
      },
    });

    const students = [
      { id: ids.studentA, fullName: "Lucas Almeida", nickname: "Luquinhas", birthDate: new Date("2018-04-12") },
      { id: ids.studentB, fullName: "Marina Souza", nickname: "Mari", birthDate: new Date("2017-09-30") },
      { id: ids.studentC, fullName: "Pedro Lima", nickname: "Pedrinho", birthDate: new Date("2015-02-05") },
    ];

    for (const s of students) {
      await db.student.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          schoolId: schoolDemo,
          fullName: s.fullName,
          nickname: s.nickname,
          birthDate: s.birthDate,
        },
      });
    }

    await db.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: ids.studentA, guardianId: ids.guardian } },
      update: {},
      create: {
        schoolId: schoolDemo,
        studentId: ids.studentA,
        guardianId: ids.guardian,
        relation: "mother",
        isLegal: true,
        isFinancial: true,
        isPickupAuthorized: true,
        verifiedAt: new Date("2026-01-10T12:00:00Z"),
        verificationMethod: "in_person_document",
      },
    });

    await db.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: ids.studentB, guardianId: ids.guardian } },
      update: {},
      create: {
        schoolId: schoolDemo,
        studentId: ids.studentB,
        guardianId: ids.guardian,
        relation: "mother",
        isLegal: true,
        isFinancial: true,
        isPickupAuthorized: true,
        verifiedAt: new Date("2026-01-10T12:00:00Z"),
        verificationMethod: "in_person_document",
      },
    });

    const term = await db.consentTerm.findUnique({
      where: { purposeCode_version: { purposeCode: "enrollment", version: "1.0" } },
    });

    if (term) {
      for (const studentId of [ids.studentA, ids.studentB]) {
        const existing = await db.consent.findFirst({
          where: { studentId, purposeCode: "enrollment", status: "granted" },
        });
        if (!existing) {
          await db.consent.create({
            data: {
              schoolId: schoolDemo,
              studentId,
              guardianId: ids.guardian,
              purposeCode: "enrollment",
              termId: term.id,
              evidenceHash: createHash("sha256").update(`${studentId}:${term.id}:${randomUUID()}`).digest("hex"),
              ip: "127.0.0.1",
              method: "portal",
            },
          });
        }
      }
    }

    await db.enrollment.upsert({
      where: { id: "01930000-0000-7000-8000-000000000501" },
      update: {},
      create: {
        id: "01930000-0000-7000-8000-000000000501",
        schoolId: schoolDemo,
        studentId: ids.studentA,
        classGroupId: ids.groupSub8,
        status: "active",
        startsOn: new Date("2026-02-01"),
        dueDay: 10,
      },
    });

    await db.enrollment.upsert({
      where: { id: "01930000-0000-7000-8000-000000000502" },
      update: {},
      create: {
        id: "01930000-0000-7000-8000-000000000502",
        schoolId: schoolDemo,
        studentId: ids.studentB,
        classGroupId: ids.groupSub8,
        status: "active",
        startsOn: new Date("2026-02-01"),
        dueDay: 5,
        // Irmã mais velha: desconto de irmão, escolhido na matrícula.
        discountCents: 5000,
      },
    });

    const plan3x = await db.tuitionPlan.upsert({
      where: { schoolId_name: { schoolId: schoolDemo, name: "Mensalidade 3x semana" } },
      update: {},
      create: {
        id: "01930000-0000-7000-8000-000000000601",
        schoolId: schoolDemo,
        name: "Mensalidade 3x semana",
        monthlyAmount: 45000,
        dueDay: 10,
      },
    });

    const plan2x = await db.tuitionPlan.upsert({
      where: { schoolId_name: { schoolId: schoolDemo, name: "Mensalidade 2x semana" } },
      update: {},
      create: {
        id: "01930000-0000-7000-8000-000000000602",
        schoolId: schoolDemo,
        name: "Mensalidade 2x semana",
        monthlyAmount: 32000,
        dueDay: 5,
      },
    });

    await db.student.update({
      where: { id: ids.studentA },
      data: { tuitionPlanId: plan3x.id },
    });
    await db.student.update({
      where: { id: ids.studentB },
      data: { tuitionPlanId: plan2x.id },
    });

    await db.school.update({
      where: { id: schoolDemo },
      data: { pixKey: "12345678000190", pixHolder: "Escola Teste Ltda", pixCity: "São Paulo" },
    });
  });

  await inSchool(schoolRival, ids.rivalUser, async () => {
    await db.student.upsert({
      where: { id: ids.rivalStudent },
      update: {},
      create: {
        id: ids.rivalStudent,
        schoolId: schoolRival,
        fullName: "Igor Rival",
        birthDate: new Date("2017-06-01"),
      },
    });
  });

  console.log("seed ok");
  console.log(`  senha de todas:  ${DEMO_PASSWORD}`);
  console.log("  login demo:      admin@demo.test / professor@demo.test");
  console.log("  responsável:     responsavel@demo.test");
  console.log("  outra escola:    admin@rival.test");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

/** Hash da senha de demonstração, calculado uma vez por execução. */
let cachedHash: Promise<string> | null = null;
function credentialHash(): Promise<string> {
  cachedHash ??= hashPassword(DEMO_PASSWORD);
  return cachedHash;
}
