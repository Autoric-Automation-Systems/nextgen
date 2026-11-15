"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@nextgen/db";
import { requireSession } from "@/lib/session";
import { resolveWorkspace } from "@/lib/workspace";
import { normalizeState, normalizeZip, roomIssue, unitIssue } from "@/lib/unit-rules";

export type UnitState = { status: "idle" | "ok" | "error"; message?: string };

const ok = (message: string): UnitState => ({ status: "ok", message });
const fail = (message: string): UnitState => ({ status: "error", message });

async function admin() {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);
  if (!workspace || !workspace.can("unit:write")) return null;
  return { session, workspace };
}

/**
 * Cadastra a unidade.
 *
 * A primeira unidade da escola nasce principal: turma precisa de um endereço, e o
 * formulário de turma já vem com a principal selecionada.
 */
export async function createUnit(_prev: UnitState, formData: FormData): Promise<UnitState> {
  const context = await admin();
  if (!context) return fail("Só a administração da escola cadastra unidade.");
  const { session, workspace } = context;

  const input = {
    name: String(formData.get("name") ?? ""),
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    zip: String(formData.get("zip") ?? ""),
  };

  const issue = unitIssue(input);
  if (issue) return fail(issue);

  try {
    const created = await withTenant(
      { schoolId: workspace.schoolId, userId: session.userId },
      async (tx) => {
        const existing = await tx.unit.count({ where: { deletedAt: null } });
        const unit = await tx.unit.create({
          data: {
            schoolId: workspace.schoolId,
            name: input.name.trim(),
            address: input.address.trim(),
            city: input.city.trim(),
            state: normalizeState(input.state),
            zip: normalizeZip(input.zip),
            isPrimary: existing === 0,
          },
          select: { id: true, name: true },
        });

        await tx.auditLog.create({
          data: {
            schoolId: workspace.schoolId,
            actorUserId: session.userId,
            actorRole: workspace.role,
            action: "unit.create",
            entity: "unit",
            entityId: unit.id,
            after: { name: unit.name, city: input.city.trim(), state: normalizeState(input.state) },
          },
        });

        return unit;
      },
    );

    revalidatePath("/unidades");
    revalidatePath("/turmas");
    return ok(`${created.name} cadastrada. Agora você pode abrir turma nela.`);
  } catch (error) {
    console.error("[unidades] falha ao criar unidade", error);
    return fail("Não foi possível cadastrar a unidade agora. Tente novamente.");
  }
}

/** Sala pertence a uma unidade da própria escola — o `unitId` do formulário nunca é confiado. */
export async function createRoom(_prev: UnitState, formData: FormData): Promise<UnitState> {
  const context = await admin();
  if (!context) return fail("Só a administração da escola cadastra sala.");
  const { session, workspace } = context;

  const unitId = String(formData.get("unitId") ?? "");
  const name = String(formData.get("name") ?? "");
  const kind = String(formData.get("kind") ?? "field");
  const capacity = Number(formData.get("capacity") ?? 20);

  const issue = roomIssue({ name, capacity });
  if (issue) return fail(issue);

  const roomKind = (["field", "court", "classroom", "gym"] as const).find((value) => value === kind);
  if (!roomKind) return fail("Tipo de sala inválido.");

  try {
    const created = await withTenant(
      { schoolId: workspace.schoolId, userId: session.userId },
      async (tx) => {
        const unit = await tx.unit.findFirst({
          where: { id: unitId, deletedAt: null },
          select: { id: true, name: true },
        });
        if (!unit) return null;

        const room = await tx.room.create({
          data: {
            schoolId: workspace.schoolId,
            unitId: unit.id,
            name: name.trim(),
            kind: roomKind,
            capacity,
          },
          select: { id: true, name: true },
        });

        await tx.auditLog.create({
          data: {
            schoolId: workspace.schoolId,
            actorUserId: session.userId,
            actorRole: workspace.role,
            action: "room.create",
            entity: "room",
            entityId: room.id,
            after: { unitId: unit.id, name: room.name, kind: roomKind, capacity },
          },
        });

        return { room, unit };
      },
    );

    if (!created) return fail("Unidade não encontrada nesta escola.");

    revalidatePath("/unidades");
    revalidatePath("/turmas");
    return ok(`Sala ${created.room.name} criada em ${created.unit.name}.`);
  } catch (error) {
    console.error("[unidades] falha ao criar sala", error);
    return fail("Não foi possível cadastrar a sala agora. Tente novamente.");
  }
}
