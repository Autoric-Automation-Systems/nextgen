import { randomUUID } from "node:crypto";
import { createAdminClient } from "@nextgen/db";
import { schoolSlug, type FirstRunInput, type SetupResult } from "./setup-rules";

/**
 * Setup da primeira escola.
 *
 * Caminho alternativo ao primeiro login, que já cria a escola de teste sozinho
 * (`bootstrap-admin.ts`). Este aqui é o que permite começar com o nome real da escola em
 * vez de "Escola Teste", e continua fechado depois do primeiro usuário.
 *
 * A conferência é refeita dentro da transação que grava, porque entre abrir a página e
 * enviar o formulário alguém pode ter criado a escola em outra aba.
 */

/**
 * Já existe alguém cadastrado?
 *
 * A contagem vai pelo cliente do dono, que tem `BYPASSRLS`: sob RLS e sem contexto de
 * escola a política devolve falso e `users` apareceria sempre vazio, que é justamente o
 * estado que esta função precisa distinguir.
 *
 * Erro responde `false`: sem banco o formulário não grava nada, e esconder a página
 * atrás de um 404 mandaria procurar conta onde o problema é conexão.
 */
export async function usersExist(): Promise<boolean> {
  let db;
  try {
    db = createAdminClient();
  } catch {
    return false;
  }

  try {
    const rows = await db.$queryRaw<{ total: number }[]>`
      select count(*)::int as total from public.users
    `;
    return (rows[0]?.total ?? 0) > 0;
  } catch {
    return false;
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

class AlreadySetUp extends Error {}

/**
 * Cria usuário, escola e vínculo de administrador numa transação.
 *
 * `set_config(..., true)` define o contexto de tenant só nesta transação: sem ele as
 * políticas de `schools` e `memberships` recusam o insert mesmo para o dono, porque as
 * tabelas usam `FORCE ROW LEVEL SECURITY`.
 */
export async function createFirstAdmin(input: FirstRunInput): Promise<SetupResult> {
  let db;
  try {
    db = createAdminClient();
  } catch {
    return { status: "unavailable", message: "Banco não configurado neste ambiente." };
  }

  const userId = randomUUID();
  const schoolId = randomUUID();
  const legalName = input.schoolLegalName ?? input.schoolName;

  try {
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ total: number }[]>`
        select count(*)::int as total from public.users
      `;
      if ((rows[0]?.total ?? 0) > 0) throw new AlreadySetUp();

      await tx.$executeRaw`select set_config('app.user_id', ${userId}, true)`;
      await tx.$executeRaw`select set_config('app.school_id', ${schoolId}, true)`;

      await tx.user.create({
        data: { id: userId, name: input.adminName, email: input.email, emailVerified: true },
      });
      await tx.school.create({
        data: {
          id: schoolId,
          slug: schoolSlug(input.schoolName),
          legalName,
          tradeName: input.schoolName,
          status: "active",
        },
      });
      await tx.membership.create({
        data: { schoolId, userId, role: "admin", status: "active" },
      });
    });
  } catch (error) {
    if (error instanceof AlreadySetUp) return { status: "already" };

    // Slug repetido: a escola existe, mas sem usuário cadastrado.
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes("schools_slug_key")) {
      return {
        status: "unavailable",
        message: "Já existe uma escola com esse endereço. Use outro nome ou complete o cadastro pelo banco.",
      };
    }

    console.error("[setup] falha ao criar a primeira escola", detail);
    return { status: "unavailable", message: "Não foi possível gravar agora. Tente de novo em instantes." };
  } finally {
    await db.$disconnect().catch(() => {});
  }

  return { status: "created", email: input.email };
}
