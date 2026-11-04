import { describe, expect, it } from "vitest";
import {
  candidates,
  pickPassword,
  stripPooler,
} from "../../../scripts/lib/migration-candidates.mjs";

const NEON_POOLED =
  "postgresql://neondb_owner:pw@ep-old-recipe-b6qd76kh-pooler.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require";

describe("stripPooler", () => {
  it("remove o sufixo do host do Neon, mantendo o resto", () => {
    const direct = stripPooler(NEON_POOLED);
    expect(direct).toContain("ep-old-recipe-b6qd76kh.c-2.sa-east-1.aws.neon.tech");
    expect(direct).not.toContain("-pooler");
    expect(direct).toContain("sslmode=require");
  });

  it("devolve undefined quando já é direta", () => {
    expect(stripPooler("postgresql://u:p@ep-x.neon.tech/db")).toBeUndefined();
  });

  it("não quebra com string inválida", () => {
    expect(stripPooler("não é url")).toBeUndefined();
  });
});

describe("candidates", () => {
  it("prefere a variável unpooled", () => {
    const list = candidates({
      DATABASE_URL_UNPOOLED: "postgresql://a@dir/db",
      DATABASE_URL: NEON_POOLED,
    });
    expect(list[0]).toEqual({ name: "DATABASE_URL_UNPOOLED", value: "postgresql://a@dir/db" });
  });

  it("deriva a direta da pooled quando só há DATABASE_URL", () => {
    const list = candidates({ DATABASE_URL: NEON_POOLED });
    const derived = list.find((c) => c.name === "DATABASE_URL sem -pooler");
    expect(derived?.value).toContain("ep-old-recipe-b6qd76kh.c-2");
  });

  it("inclui a pooled como último recurso", () => {
    const list = candidates({ DATABASE_URL: NEON_POOLED });
    expect(list.at(-1)).toEqual({ name: "DATABASE_URL", value: NEON_POOLED });
  });

  it("não repete a mesma URL em nomes diferentes", () => {
    const list = candidates({
      DATABASE_URL_UNPOOLED: "postgresql://a@dir/db",
      POSTGRES_URL_NON_POOLING: "postgresql://a@dir/db",
    });
    expect(list).toHaveLength(1);
  });

  it("lista vazia sem nenhuma variável", () => {
    expect(candidates({})).toEqual([]);
  });
});

describe("pickPassword", () => {
  it("prefere o nome próprio do projeto", () => {
    expect(pickPassword({ APP_DB_PASSWORD: "a", PGPASSWORD: "b" })?.name).toBe("APP_DB_PASSWORD");
  });

  it("undefined quando não há nenhuma", () => {
    expect(pickPassword({})).toBeUndefined();
  });
});
