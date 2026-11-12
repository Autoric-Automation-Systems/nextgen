import { describe, expect, it } from "vitest";
import { CONSENT_PURPOSES, PURPOSE_CODES, type ConsentPurpose } from "@nextgen/core";
import { PURPOSE_LABELS, resolvePurpose } from "./consent";

const purposes = Object.keys(CONSENT_PURPOSES) as ConsentPurpose[];

describe("consentimento: catálogo de finalidades", () => {
  it("toda finalidade do core tem rótulo, descrição e consequência na tela", () => {
    for (const purpose of purposes) {
      const label = PURPOSE_LABELS[PURPOSE_CODES[purpose]];

      expect(label, PURPOSE_CODES[purpose]).toBeDefined();
      expect(label!.name.length).toBeGreaterThan(3);
      expect(label!.description.length).toBeGreaterThan(10);
      expect(label!.consequence.length).toBeGreaterThan(10);
    }
  });

  it("não sobra rótulo órfão: o mapa da tela e o catálogo do core têm o mesmo tamanho", () => {
    expect(Object.keys(PURPOSE_LABELS)).toHaveLength(purposes.length);
  });

  it("resolvePurpose traduz o código do banco para a chave do core", () => {
    expect(resolvePurpose("public_card")).toBe("publicCard");
    expect(resolvePurpose("health_anamnesis")).toBe("healthAnamnesis");
    for (const purpose of purposes) {
      expect(resolvePurpose(PURPOSE_CODES[purpose])).toBe(purpose);
    }
  });

  it("código desconhecido não vira finalidade válida", () => {
    expect(resolvePurpose("publicCard")).toBeNull();
    expect(resolvePurpose("")).toBeNull();
    expect(resolvePurpose("__proto__")).toBeNull();
  });
});
