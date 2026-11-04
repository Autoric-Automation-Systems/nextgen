import { describe, expect, it } from "vitest";
import { ageOn, deriveCategory, matchesCategory, suggestBirthYearRange } from "../category";

const sub8 = { id: "sub8", name: "Sub-8", birthYearFrom: 2018, birthYearTo: 2018 };
const sub9 = { id: "sub9", name: "Sub-9", birthYearFrom: 2017, birthYearTo: 2017 };
const open = { id: "open", name: "Livre", birthYearFrom: null, birthYearTo: null };

describe("ageOn", () => {
  it("conta anos completos", () => {
    expect(ageOn(new Date("2018-04-12"), new Date("2026-04-11"))).toBe(7);
    expect(ageOn(new Date("2018-04-12"), new Date("2026-04-12"))).toBe(8);
  });

  it("não erra na virada do ano", () => {
    expect(ageOn(new Date("2017-12-31"), new Date("2026-01-01"))).toBe(8);
  });
});

describe("matchesCategory", () => {
  it("casa por ano de nascimento", () => {
    expect(matchesCategory(new Date("2018-04-12"), sub8)).toBe(true);
    expect(matchesCategory(new Date("2017-12-31"), sub8)).toBe(false);
  });

  it("categoria sem faixa nunca casa", () => {
    expect(matchesCategory(new Date("2018-04-12"), open)).toBe(false);
  });
});

describe("deriveCategory", () => {
  it("encontra a categoria única", () => {
    const result = deriveCategory(new Date("2017-09-30"), [sub8, sub9]);
    expect(result).toEqual({ ok: true, categoryId: "sub9", outOfRange: false });
  });

  it("sinaliza quando a idade não cabe em nenhuma", () => {
    const result = deriveCategory(new Date("2012-01-01"), [sub8, sub9]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_match");
  });

  it("sinaliza ambiguidade em vez de escolher sozinho", () => {
    const overlapping = { id: "dup", name: "Sub-9 B", birthYearFrom: 2017, birthYearTo: 2017 };
    const result = deriveCategory(new Date("2017-05-05"), [sub9, overlapping]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ambiguous");
      expect(result.candidates).toHaveLength(2);
    }
  });
});

describe("suggestBirthYearRange", () => {
  it("deriva o ano pela categoria", () => {
    expect(suggestBirthYearRange("Sub-8", 2026)).toEqual({ from: 2018, to: 2018 });
    expect(suggestBirthYearRange("sub 11", 2026)).toEqual({ from: 2015, to: 2015 });
  });

  it("ignora nome que não é categoria", () => {
    expect(suggestBirthYearRange("Adulto", 2026)).toBeNull();
    expect(suggestBirthYearRange("Sub-99", 2026)).toBeNull();
  });
});
