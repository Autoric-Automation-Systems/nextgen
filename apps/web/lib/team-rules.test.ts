import { describe, expect, it } from "vitest";
import { ROLES } from "@nextgen/core";
import { INVITABLE_ROLES, ROLE_LABELS, isInvitableRole } from "./team";

describe("equipe: papéis do convite", () => {
  it("todo papel do sistema tem rótulo em português", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], role).toBeTruthy();
    }
  });

  it("convite não distribui papel de responsável nem de suporte da plataforma", () => {
    expect(INVITABLE_ROLES).not.toContain("guardian");
    expect(INVITABLE_ROLES).not.toContain("platform_support");
    expect(isInvitableRole("guardian")).toBe(false);
    expect(isInvitableRole("platform_support")).toBe(false);
    expect(isInvitableRole("teacher")).toBe(true);
  });
});
