import { describe, expect, it } from "vitest";
import {
  isRolePrivilegeFailure,
  isWeakPasswordFailure,
  parseFailedMigration,
} from "../../../scripts/lib/migration-failure.mjs";

describe("parseFailedMigration", () => {
  it("lê o nome do erro de quem acabou de falhar (P3018)", () => {
    const output = `Error: P3018

A migration failed to apply. New migrations cannot be applied before the error is recovered from.

Migration name: 20260101000100_rls

Database error code: 42501`;

    expect(parseFailedMigration(output)).toBe("20260101000100_rls");
  });

  it("lê o nome de quem está bloqueado por falha anterior (P3009)", () => {
    const output = `Error: P3009

migrate found failed migrations in the target database
The \`20260101000100_rls\` migration started at 2026-11-04 13:58:42.123 UTC failed`;

    expect(parseFailedMigration(output)).toBe("20260101000100_rls");
  });

  it("undefined quando não há falha de migração", () => {
    expect(parseFailedMigration("All migrations have been successfully applied.")).toBeUndefined();
    expect(parseFailedMigration("")).toBeUndefined();
  });
});

describe("isRolePrivilegeFailure", () => {
  it("reconhece a recusa de CREATE ROLE do Neon", () => {
    expect(
      isRolePrivilegeFailure("ERROR: permission denied to create role\nDETAIL: Only roles with the CREATEROLE attribute may create roles."),
    ).toBe(true);
  });

  it("reconhece pelo código 42501", () => {
    expect(isRolePrivilegeFailure("Database error code: 42501")).toBe(true);
  });

  it("não confunde com erro de conexão", () => {
    expect(isRolePrivilegeFailure("Can't reach database server")).toBe(false);
  });
});

describe("isWeakPasswordFailure", () => {
  it("reconhece a recusa de senha fraca do Neon", () => {
    const output =
      'ERROR: Received HTTP code 400 from control plane: {"error":"insecure password, try including more special characters"}';

    expect(isWeakPasswordFailure(output)).toBe(true);
  });

  it("não confunde com outros erros de permissão", () => {
    expect(isWeakPasswordFailure("permission denied to alter role")).toBe(false);
  });
});
