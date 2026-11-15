import { withTenant } from "@nextgen/db";

export type RoomRow = {
  id: string;
  name: string;
  kind: "field" | "court" | "classroom" | "gym";
  capacity: number;
  classGroups: number;
};

export type UnitRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  rooms: RoomRow[];
  classGroups: number;
};

export const ROOM_KIND_LABEL: Record<RoomRow["kind"], string> = {
  field: "Campo",
  court: "Quadra",
  gym: "Ginásio",
  classroom: "Sala de aula",
};

/**
 * Unidade é o endereço onde a turma treina; sala é o espaço dentro dela.
 *
 * Sem unidade não existe turma, e sem turma não existe matrícula — é a primeira coisa que
 * uma escola nova precisa cadastrar, por isso a tela mostra a contagem de turmas: unidade
 * sem turma é endereço digitado e esquecido.
 */
export async function listUnitsWithRooms(ctx: { schoolId: string; userId: string }): Promise<UnitRow[]> {
  return withTenant(ctx, async (tx) => {
    const units = await tx.unit.findMany({
      where: { deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
      include: {
        rooms: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, kind: true, capacity: true },
        },
        _count: { select: { classGroups: true } },
      },
    });

    const roomUsage = await tx.classGroup.groupBy({
      by: ["roomId"],
      where: { deletedAt: null, roomId: { not: null } },
      _count: { _all: true },
    });
    const usageByRoom = new Map(roomUsage.map((row) => [row.roomId, row._count._all]));

    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      address: unit.address,
      city: unit.city,
      state: unit.state,
      zip: unit.zip,
      isPrimary: unit.isPrimary,
      classGroups: unit._count.classGroups,
      rooms: unit.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        kind: room.kind,
        capacity: room.capacity,
        classGroups: usageByRoom.get(room.id) ?? 0,
      })),
    }));
  });
}
