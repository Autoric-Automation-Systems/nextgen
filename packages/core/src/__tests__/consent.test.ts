import { describe, expect, it } from "vitest";
import {
  ageRegime,
  canHoldOwnLogin,
  canPublishPublicCard,
  checkEnrollmentConsent,
  isPubliclyVisibleSkill,
  requiresHighlightedConsent,
} from "../consent";

describe("ageRegime", () => {
  it("classifica as faixas do doc 02", () => {
    expect(ageRegime(7)).toBe("child");
    expect(ageRegime(11)).toBe("child");
    expect(ageRegime(12)).toBe("teen");
    expect(ageRegime(15)).toBe("teen");
    expect(ageRegime(16)).toBe("own_account");
    expect(ageRegime(18)).toBe("adult");
  });

  it("só permite login próprio a partir dos 16", () => {
    expect(canHoldOwnLogin(15)).toBe(false);
    expect(canHoldOwnLogin(16)).toBe(true);
  });

  it("marca consentimento em destaque abaixo de 12", () => {
    expect(requiresHighlightedConsent(11)).toBe(true);
    expect(requiresHighlightedConsent(12)).toBe(false);
  });
});

describe("checkEnrollmentConsent", () => {
  it("libera matrícula com o consentimento obrigatório", () => {
    const result = checkEnrollmentConsent([{ purpose: "enrollment", status: "granted" }]);
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("bloqueia quando falta o consentimento obrigatório", () => {
    const result = checkEnrollmentConsent([]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain("enrollment");
  });

  it("não exige consentimento de imagem para matricular", () => {
    const result = checkEnrollmentConsent([{ purpose: "enrollment", status: "granted" }]);
    expect(result.missing).not.toContain("image_public");
    expect(result.missing).not.toContain("public_card");
  });

  it("não trata consentimento opcional revogado como bloqueio de matrícula", () => {
    const result = checkEnrollmentConsent([
      { purpose: "enrollment", status: "granted" },
      { purpose: "imagePublic", status: "revoked" },
    ]);
    expect(result.allowed).toBe(true);
  });

  it("bloqueia quando consentimento sensível foi revogado", () => {
    const result = checkEnrollmentConsent([
      { purpose: "enrollment", status: "granted" },
      { purpose: "healthAnamnesis", status: "revoked" },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toContain("health_anamnesis");
  });
});

describe("canPublishPublicCard", () => {
  it("nunca publica card de menor de 12", () => {
    expect(canPublishPublicCard({ age: 9, optedIn: true, imagePublicConsent: "granted" })).toEqual({
      allowed: false,
      reason: "under_12",
    });
  });

  it("exige opt-in explícito", () => {
    expect(canPublishPublicCard({ age: 14, optedIn: false, imagePublicConsent: "granted" })).toEqual({
      allowed: false,
      reason: "not_opt_in",
    });
  });

  it("exige consentimento de imagem pública vigente", () => {
    expect(canPublishPublicCard({ age: 14, optedIn: true, imagePublicConsent: "missing" }).allowed).toBe(false);
    expect(canPublishPublicCard({ age: 14, optedIn: true, imagePublicConsent: "revoked" }).allowed).toBe(false);
    expect(canPublishPublicCard({ age: 14, optedIn: true, imagePublicConsent: "granted" }).allowed).toBe(true);
  });
});

describe("isPubliclyVisibleSkill", () => {
  it("esconde o pilar comportamental do público", () => {
    expect(isPubliclyVisibleSkill("technical")).toBe(true);
    expect(isPubliclyVisibleSkill("behavioral")).toBe(false);
  });
});
