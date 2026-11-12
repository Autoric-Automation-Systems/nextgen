/**
 * Dados de demonstração: a "Escola Teste", com alunos, responsáveis, notas e matrículas.
 *
 * Existe para o site e o painel poderem ser vistos com conteúdo, e para a administração da
 * plataforma ter onde explorar sem tocar em dado de escola real. É idempotente: rodar de
 * novo não duplica nem sobrescreve o que já existe.
 *
 * Todo registro tem o prefixo `01940000-...` no id e o sobrenome "Teste" nos nomes, então
 * apagar é um `delete from schools where slug = 'escola-teste'` — o resto cai em cascata,
 * exceto `users`, que é global.
 *
 *   pnpm --filter @nextgen/db seed:demo
 */
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "../src/client";

const db = createAdminClient();

const school = "01940000-0000-7000-8000-000000000001";

const ids = {
  unit: "01940000-0000-7000-8000-000000000101",
  roomField: "01940000-0000-7000-8000-000000000102",
  roomLocker: "01940000-0000-7000-8000-000000000103",
  groupSub9: "01940000-0000-7000-8000-000000000111",
  groupSub11: "01940000-0000-7000-8000-000000000112",
  groupSub13: "01940000-0000-7000-8000-000000000113",
  adminUser: "01940000-0000-7000-8000-000000000201",
  teacherUser: "01940000-0000-7000-8000-000000000202",
  guardianUser: "01940000-0000-7000-8000-000000000203",
  guardian2User: "01940000-0000-7000-8000-000000000204",
  guardian: "01940000-0000-7000-8000-000000000211",
  guardian2: "01940000-0000-7000-8000-000000000212",
} as const;

const PURPOSES = [
  { code: "enrollment", name: "Matrícula e execução do contrato", required: true, sensitive: false },
  { code: "image_internal", name: "Uso interno de imagem", required: false, sensitive: false },
  { code: "image_public", name: "Divulgação de imagem em marketing", required: false, sensitive: false },
  { code: "public_card", name: "Perfil público do aluno", required: false, sensitive: false },
  { code: "health_anamnesis", name: "Anamnese e prontuário", required: false, sensitive: true },
  { code: "health_emergency", name: "Kit de emergência", required: false, sensitive: true },
  { code: "marketing", name: "Comunicações de marketing", required: false, sensitive: false },
];

type DemoStudent = {
  key: string;
  fullName: string;
  nickname: string;
  birthDate: string;
  position: string;
  jersey: number;
  group: string;
  guardian: string;
  /** Notas do ciclo mais recente, escala 1–5 do doc 08. */
  scores: Record<string, number>;
  /** Quanto cada atributo subiu desde o ciclo anterior. */
  delta: number;
  publicCard: boolean;
};

/**
 * Idades calculadas contra 2026: um aluno de 8 anos (barras, sem nota) e um de 13 (com
 * nota no card), para as duas regras do doc 08 aparecerem na demonstração.
 */
const STUDENTS: DemoStudent[] = [
  {
    key: "alunoTeste",
    fullName: "Aluno Teste",
    nickname: "Pedrinho",
    birthDate: "2018-03-14",
    position: "Atacante",
    jersey: 9,
    group: ids.groupSub9,
    guardian: ids.guardian,
    scores: { CTL: 4, PAS: 3, FIN: 4, DRI: 4, VEL: 4, AGI: 4, RES: 3, FOR: 2, POS: 3, DEF: 2, VIS: 3, MOV: 4, DIS: 4, EQU: 4, RESI: 3, FOC: 3 },
    delta: 1,
    publicCard: false,
  },
  {
    key: "marinaTeste",
    fullName: "Marina Teste",
    nickname: "Mari",
    birthDate: "2017-09-30",
    position: "Meio-campo",
    jersey: 8,
    group: ids.groupSub9,
    guardian: ids.guardian,
    scores: { CTL: 4, PAS: 4, FIN: 3, DRI: 4, VEL: 3, AGI: 4, RES: 4, FOR: 2, POS: 4, DEF: 3, VIS: 4, MOV: 3, DIS: 5, EQU: 4, RESI: 4, FOC: 4 },
    delta: 0,
    publicCard: false,
  },
  {
    key: "lucasTeste",
    fullName: "Lucas Teste",
    nickname: "Luquinhas",
    birthDate: "2016-01-22",
    position: "Lateral",
    jersey: 2,
    group: ids.groupSub11,
    guardian: ids.guardian2,
    scores: { CTL: 3, PAS: 3, FIN: 2, DRI: 3, VEL: 4, AGI: 4, RES: 4, FOR: 3, POS: 3, DEF: 4, VIS: 3, MOV: 4, DIS: 3, EQU: 4, RESI: 3, FOC: 3 },
    delta: 1,
    publicCard: false,
  },
  {
    key: "helenaTeste",
    fullName: "Helena Teste",
    nickname: "Lena",
    birthDate: "2015-06-08",
    position: "Zagueiro",
    jersey: 4,
    group: ids.groupSub11,
    guardian: ids.guardian2,
    scores: { CTL: 3, PAS: 3, FIN: 2, DRI: 2, VEL: 3, AGI: 3, RES: 4, FOR: 4, POS: 4, DEF: 4, VIS: 3, MOV: 3, DIS: 4, EQU: 3, RESI: 4, FOC: 3 },
    delta: 0,
    publicCard: false,
  },
  {
    key: "tiagoTeste",
    fullName: "Tiago Teste",
    nickname: "Tiaguinho",
    birthDate: "2013-11-03",
    position: "Atacante",
    jersey: 11,
    group: ids.groupSub13,
    guardian: ids.guardian,
    scores: { CTL: 4, PAS: 4, FIN: 5, DRI: 5, VEL: 5, AGI: 4, RES: 4, FOR: 3, POS: 4, DEF: 2, VIS: 4, MOV: 5, DIS: 4, EQU: 4, RESI: 3, FOC: 4 },
    delta: 1,
    publicCard: true,
  },
];

/** Contexto de tenant para a RLS forçada também valer para o dono das tabelas. */
async function inSchool<T>(schoolId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('app.school_id', ${schoolId}, true)`;
    await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
    return fn();
  });
}

async function seedPurposes() {
  for (const purpose of PURPOSES) {
    await db.consentPurpose.upsert({
      where: { code: purpose.code },
      update: {},
      create: {
        code: purpose.code,
        name: purpose.name,
        description: purpose.name,
        isRequired: purpose.required,
        isSensitive: purpose.sensitive,
      },
    });

    const body = `# Termo de consentimento — ${purpose.name}\n\nVersão 1.0.`;
    await db.consentTerm.upsert({
      where: { purposeCode_version: { purposeCode: purpose.code, version: "1.0" } },
      update: {},
      create: {
        purposeCode: purpose.code,
        version: "1.0",
        bodyMarkdown: body,
        bodyHash: createHash("sha256").update(body).digest("hex"),
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });
  }
}

async function seedSchoolStructure() {
  await inSchool(school, "", async () => {
    await db.school.upsert({
      where: { id: school },
      update: {},
      create: {
        id: school,
        slug: "escola-teste",
        legalName: "Escola Teste de Futebol Ltda",
        tradeName: "Escola Teste",
        status: "active",
        planCode: "escola",
        tagline: "Formar jogador, formar pessoa.",
        palette: { brand: "#10331f", accent: "#c9f24d" },
        // Marcador de demonstração: telas públicas usam isto para não vender dado fictício
        // como escola real.
        settings: { demo: true, city: "São Paulo", state: "SP" },
      },
    });

    await db.unit.upsert({
      where: { id: ids.unit },
      update: {},
      create: {
        id: ids.unit,
        schoolId: school,
        name: "Sede Centro",
        address: "Rua das Chuteiras, 100",
        city: "São Paulo",
        state: "SP",
        zip: "01000-000",
        isPrimary: true,
      },
    });

    for (const [id, name, kind] of [
      [ids.roomField, "Campo 1", "field"],
      [ids.roomLocker, "Sala de vídeo", "classroom"],
    ] as const) {
      await db.room.upsert({
        where: { id },
        update: {},
        create: { id, schoolId: school, unitId: ids.unit, name, kind, capacity: 24 },
      });
    }

    const groups = [
      [ids.groupSub9, "Sub-9 — Ter/Qui 17h", [2, 4], "17:00", "18:00"],
      [ids.groupSub11, "Sub-11 — Seg/Qua 18h", [1, 3], "18:00", "19:00"],
      [ids.groupSub13, "Sub-13 — Ter/Qui 19h", [2, 4], "19:00", "20:30"],
    ] as const;

    for (const [id, name, weekdays, startTime, endTime] of groups) {
      await db.classGroup.upsert({
        where: { id },
        update: {},
        create: {
          id,
          schoolId: school,
          unitId: ids.unit,
          roomId: ids.roomField,
          name,
          weekdays: [...weekdays],
          startTime,
          endTime,
          capacity: 20,
        },
      });
    }
  });
}

async function seedPeople() {
  const people = [
    { id: ids.adminUser, name: "Ana Teste", email: "admin@escola-teste.test", role: "admin" as const },
    { id: ids.teacherUser, name: "Bruno Teste", email: "professor@escola-teste.test", role: "teacher" as const },
    { id: ids.guardianUser, name: "Carla Teste", email: "responsavel@escola-teste.test", role: "guardian" as const },
    { id: ids.guardian2User, name: "Diego Teste", email: "responsavel2@escola-teste.test", role: "guardian" as const },
  ];

  for (const person of people) {
    await db.user.upsert({
      where: { email: person.email },
      update: {},
      create: {
        id: person.id,
        name: person.name,
        email: person.email,
        emailVerified: true,
        phone: "+5511999990000",
      },
    });

    await inSchool(school, person.id, async () => {
      await db.membership.upsert({
        where: { schoolId_userId: { schoolId: school, userId: person.id } },
        update: {},
        create: { schoolId: school, userId: person.id, role: person.role, status: "active" },
      });
    });
  }

  await inSchool(school, ids.adminUser, async () => {
    for (const [id, userId, relation] of [
      [ids.guardian, ids.guardianUser, "mother"],
      [ids.guardian2, ids.guardian2User, "father"],
    ] as const) {
      await db.guardian.upsert({
        where: { schoolId_userId: { schoolId: school, userId } },
        update: {},
        create: {
          id,
          schoolId: school,
          userId,
          cpfLast4: "4321",
          phone: "+5511988887777",
          relationDefault: relation,
        },
      });
    }

    await db.classGroupTeacher.upsert({
      where: {
        classGroupId_userId_fromDate: {
          classGroupId: ids.groupSub9,
          userId: ids.teacherUser,
          fromDate: new Date("2026-01-15"),
        },
      },
      update: {},
      create: {
        schoolId: school,
        classGroupId: ids.groupSub9,
        userId: ids.teacherUser,
        isLead: true,
        fromDate: new Date("2026-01-15"),
      },
    });
  });
}

async function seedStudents() {
  const enrollmentTerm = await db.consentTerm.findUnique({
    where: { purposeCode_version: { purposeCode: "enrollment", version: "1.0" } },
  });
  const imagePublicTerm = await db.consentTerm.findUnique({
    where: { purposeCode_version: { purposeCode: "image_public", version: "1.0" } },
  });

  await inSchool(school, ids.adminUser, async () => {
    for (const student of STUDENTS) {
      const id = `01940000-0000-7000-8000-0000000003${String(STUDENTS.indexOf(student)).padStart(2, "0")}`;

      await db.student.upsert({
        where: { id },
        update: {},
        create: {
          id,
          schoolId: school,
          fullName: student.fullName,
          nickname: student.nickname,
          birthDate: new Date(student.birthDate),
          position: student.position,
          jerseyNumber: student.jersey,
          publicCardSlug: student.publicCard ? `escola-teste-${student.nickname.toLowerCase()}` : null,
          publicCardEnabled: student.publicCard,
        },
      });

      await db.studentGuardian.upsert({
        where: { studentId_guardianId: { studentId: id, guardianId: student.guardian } },
        update: {},
        create: {
          schoolId: school,
          studentId: id,
          guardianId: student.guardian,
          relation: student.guardian === ids.guardian ? "mother" : "father",
          isLegal: true,
          isFinancial: true,
          isPickupAuthorized: true,
          verifiedAt: new Date("2026-01-10T12:00:00Z"),
          verificationMethod: "in_person_document",
        },
      });

      await db.enrollment.upsert({
        where: { id: `01940000-0000-7000-8000-0000000004${String(STUDENTS.indexOf(student)).padStart(2, "0")}` },
        update: {},
        create: {
          id: `01940000-0000-7000-8000-0000000004${String(STUDENTS.indexOf(student)).padStart(2, "0")}`,
          schoolId: school,
          studentId: id,
          classGroupId: student.group,
          status: "active",
          startsOn: new Date("2026-02-01"),
        },
      });

      if (enrollmentTerm) {
        const existing = await db.consent.findFirst({
          where: { studentId: id, purposeCode: "enrollment", status: "granted" },
        });
        if (!existing) {
          await db.consent.create({
            data: {
              schoolId: school,
              studentId: id,
              guardianId: student.guardian,
              purposeCode: "enrollment",
              termId: enrollmentTerm.id,
              evidenceHash: createHash("sha256").update(`${id}:${enrollmentTerm.id}:${randomUUID()}`).digest("hex"),
              ip: "127.0.0.1",
              method: "portal",
            },
          });
        }
      }

      // Card público exige consentimento de imagem vigente: sem ele, `canPublishPublicCard`
      // barra mesmo que a escola tenha marcado "publicar".
      if (student.publicCard && imagePublicTerm) {
        const existing = await db.consent.findFirst({
          where: { studentId: id, purposeCode: "image_public", status: "granted" },
        });
        if (!existing) {
          await db.consent.create({
            data: {
              schoolId: school,
              studentId: id,
              guardianId: student.guardian,
              purposeCode: "image_public",
              termId: imagePublicTerm.id,
              evidenceHash: createHash("sha256").update(`${id}:img:${randomUUID()}`).digest("hex"),
              ip: "127.0.0.1",
              method: "portal",
            },
          });
        }
      }

      await seedRatings(id, student);
    }
  });
}

/**
 * Dois ciclos, para a variação (+1 ou 0) ter de onde sair. O ciclo anterior é o mesmo
 * valor menos o delta, limitado à escala.
 */
async function seedRatings(studentId: string, student: DemoStudent) {
  const cycles = [
    { label: "2026-T1", shift: -student.delta },
    { label: "2026-T2", shift: 0 },
  ];

  for (const cycle of cycles) {
    for (const [code, score] of Object.entries(student.scores)) {
      const value = Math.min(5, Math.max(1, score + cycle.shift));

      await db.studentSkillRating.upsert({
        where: { studentId_cycleLabel_code: { studentId, cycleLabel: cycle.label, code } },
        update: {},
        create: {
          schoolId: school,
          studentId,
          cycleLabel: cycle.label,
          code,
          score: value,
          ratedByUserId: ids.teacherUser,
        },
      });
    }
  }
}

async function main() {
  await seedPurposes();
  await seedSchoolStructure();
  await seedPeople();
  await seedStudents();

  console.log(`Escola Teste pronta: ${STUDENTS.length} alunos, ${STUDENTS.length * 16 * 2} notas.`);
  console.log("Acessos de demonstração: admin@escola-teste.test, responsavel@escola-teste.test");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
