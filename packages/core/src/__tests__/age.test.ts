import { describe, expect, it } from "vitest";
import { ageOn, birthYear } from "../age";

describe("ageOn", () => {
  it("conta anos completos", () => {
    expect(ageOn(new Date("2018-04-12"), new Date("2026-04-11"))).toBe(7);
    expect(ageOn(new Date("2018-04-12"), new Date("2026-04-12"))).toBe(8);
  });

  it("não erra na virada do ano", () => {
    expect(ageOn(new Date("2017-12-31"), new Date("2026-01-01"))).toBe(8);
  });
});

describe("birthYear", () => {
  it("lê o ano em UTC", () => {
    expect(birthYear(new Date("2017-12-31T00:00:00Z"))).toBe(2017);
  });
});
