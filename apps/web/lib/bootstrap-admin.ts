import { randomUUID } from "node:crypto";
import { isPlatformAdmin } from "@nextgen/auth";
import { createAdminClient, type Prisma } from "@nextgen/db";
import {
  adminNameFromEmail,
  decideBootstrap,
  slugCandidate,
  TEST_SCHOOL,
  TEST_STUDENT,
  type BootstrapDecision,
} from "./bootstrap-rules";

export type BootstrapOutcome =
  | { status: "none"; decision: BootstrapDecision }
  | { status: "created"; schoolSlug: string; platformStaff: boolean }
  | { status: "attached"; schoolSlug: string }
  | { status: "unavailable" };

/** Quantas variações de slug tentar antes de desistir. */
const SLUG_ATTEMPTS = 9;

/**
 * Prepara usuário e escola no primeiro acesso.
 *
 * Chamada pelo login antes de pedir o link mágico. Sem isso, numa instalação com
 * `users = 0` o link chega e a verificação falha com `new_user_signup_disabled`: o
 * `disableSignUp` do Better Auth não cria conta. Aqui a conta passa a existir.
 *
 * Nunca lança: falhar aqui não pode impedir alguém de tentar entrar.
 */
export async function ensureBootstrapAdmin(email: string): Promise<BootstrapOutcome> {
  const normalized = email.trim().toLowerCase();
  const allowlisted = isPlatformAdmin({ email: normalized });

  let db;
  try {
    db = createAdminClient();
  } catch {
    return { status: "unavailable" };
  }

  try {
    return await db.$transaction(async (tx) => {
      const counts = await tx.$queryRaw<{ total: number }[]>`
        select count(*)::int as total from public.users
      `;
      const totalUsers = counts[0]?.total ?? 0;

      // `users` é a única tabela com RLS desligada para o dono: o login precisa ler
      // pelo e-mail antes de existir sessão.
      const existing = await tx.user.findUnique({
        where: { email: normalized },
        select: { id: true, isPlatformStaff: true },
      });

      let hasMembership = false;
      if (existing) {
        await tx.$executeRaw`select set_config('app.user_id', ${existing.id}, true)`;
        const membership = await tx.membership.findFirst({
          where: { userId: existing.id, status: "active" },
          select: { schoolId: true },
        });
        hasMembership = membership !== null;
      }

      // Numa instalação vazia, quem chega primeiro é quem instalou: o operador da
      // plataforma. Sem isso, publicar o produto e entrar exigiria editar env em paralelo
      // — e enquanto ninguém é da plataforma, nenhum dos menus de suporte existe.
      const isOperator = allowlisted || totalUsers === 0;

      const decision = decideBootstrap({
        totalUsers,
        allowlisted,
        userExists: existing !== null,
        hasMembership,
      });

      if (decision === "none") return { status: "none", decision } as const;

      const userId = existing?.id ?? randomUUID();
      if (!existing) {
        await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
        await tx.user.create({
          data: {
            id: userId,
            name: adminNameFromEmail(normalized),
            email: normalized,
            emailVerified: true,
            isPlatformStaff: isOperator,
          },
        });
      } else if (isOperator && !existing.isPlatformStaff) {
        // A coluna sobrevive à remoção da env: gravar agora evita depender de redeploy.
        await tx.user.update({ where: { id: userId }, data: { isPlatformStaff: true } });
      }

      const school = await createTestSchool(tx);
      if (!school) return { status: "unavailable" } as const;

      await tx.membership.create({
        data: { schoolId: school.id, userId, role: "admin", status: "active" },
      });

      await createTestStudent(tx, school.id);

      return existing
        ? ({ status: "attached", schoolSlug: school.slug } as const)
        : ({ status: "created", schoolSlug: school.slug, platformStaff: isOperator } as const);
    });
  } catch (error) {
    console.error("[bootstrap] falha ao preparar primeiro acesso", error);
    return { status: "unavailable" };
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

type Tx = Prisma.TransactionClient;

/**
 * Cria a escola de teste e entra no contexto de tenant dela.
 *
 * O insert é cru porque o slug pode já existir e a política de RLS impede descobrir isso
 * antes: `on conflict do nothing returning` responde "não criou" sem erro, e o laço tenta
 * `escola-teste-2`, `-3`… em vez de derrubar o login.
 */
async function createTestSchool(tx: Tx): Promise<{ id: string; slug: string } | null> {
  const schoolId = randomUUID();
  await tx.$executeRaw`select set_config('app.school_id', ${schoolId}, true)`;

  for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
    const slug = slugCandidate(TEST_SCHOOL.slug, attempt);
    const rows = await tx.$queryRaw<{ id: string }[]>`
      insert into public.schools (id, slug, legal_name, trade_name, status, updated_at)
      values (${schoolId}::uuid, ${slug}, ${TEST_SCHOOL.legalName}, ${TEST_SCHOOL.tradeName}, 'active', now())
      on conflict (slug) do nothing
      returning id
    `;

    if (rows.length > 0) return { id: schoolId, slug };
  }

  return null;
}

async function createTestStudent(tx: Tx, schoolId: string) {
  const studentId = randomUUID();
  await tx.$executeRaw`select set_config('app.school_id', ${schoolId}, true)`;
  await tx.student.create({
    data: {
      id: studentId,
      schoolId,
      fullName: TEST_STUDENT.fullName,
      nickname: TEST_STUDENT.nickname,
      birthDate: new Date(`${TEST_STUDENT.birthDate}T00:00:00Z`),
      position: TEST_STUDENT.position,
      jerseyNumber: TEST_STUDENT.jerseyNumber,
    },
  });
}
