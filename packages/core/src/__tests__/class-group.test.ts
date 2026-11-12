import { describe, expect, it } from "vitest";
import {
  decideEnrollment,
  formatSchedule,
  occupancyPercent,
  overlaps,
  parseTime,
  resolveOverriddenEnrollment,
  seatsLeft,
  validateSchedule,
  validOverrideReason,
} from "../class-group";

describe("validateSchedule", () => {
  it("aceita Ter/Qui 17h–18h", () => {
    const result = validateSchedule({ weekdays: [2, 4], startTime: "17:00", endTime: "18:00" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.durationMinutes).toBe(60);
      expect(result.weekdays).toEqual([2, 4]);
    }
  });

  it("recusa turma sem dia", () => {
    const result = validateSchedule({ weekdays: [], startTime: "17:00", endTime: "18:00" });
    expect(result).toEqual({ ok: false, issue: "no_weekday" });
  });

  it("recusa dia repetido e dia fora da semana", () => {
    expect(validateSchedule({ weekdays: [2, 2], startTime: "17:00", endTime: "18:00" })).toEqual({
      ok: false,
      issue: "duplicate_weekday",
    });
    expect(validateSchedule({ weekdays: [7], startTime: "17:00", endTime: "18:00" })).toEqual({
      ok: false,
      issue: "invalid_weekday",
    });
  });

  it("exige HH:MM de 24 horas", () => {
    expect(validateSchedule({ weekdays: [2], startTime: "5pm", endTime: "18:00" })).toEqual({
      ok: false,
      issue: "invalid_time",
    });
    expect(validateSchedule({ weekdays: [2], startTime: "17:00", endTime: "24:00" })).toEqual({
      ok: false,
      issue: "invalid_time",
    });
  });

  it("recusa fim antes do início e aula curta demais", () => {
    expect(validateSchedule({ weekdays: [2], startTime: "18:00", endTime: "17:00" })).toEqual({
      ok: false,
      issue: "end_before_start",
    });
    expect(validateSchedule({ weekdays: [2], startTime: "17:00", endTime: "17:15" })).toEqual({
      ok: false,
      issue: "too_short",
    });
    expect(validateSchedule({ weekdays: [2], startTime: "08:00", endTime: "13:00" })).toEqual({
      ok: false,
      issue: "too_long",
    });
  });
});

describe("parseTime", () => {
  it("converte e rejeita", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("20:30")).toBe(1230);
    expect(parseTime(" 7:05 ")).toBeNull();
    expect(parseTime("7:5")).toBeNull();
  });
});

describe("formatSchedule", () => {
  it("escreve como a secretaria fala", () => {
    expect(formatSchedule({ weekdays: [2, 4], startTime: "17:00", endTime: "18:00" })).toBe(
      "Ter/Qui · 17h–18h",
    );
    expect(formatSchedule({ weekdays: [6], startTime: "09:00", endTime: "10:30" })).toBe(
      "Sáb · 9h–10h30",
    );
  });
});

describe("overlaps", () => {
  const base = { weekdays: [2, 4], startTime: "17:00", endTime: "18:00" };

  it("detecta choque no mesmo dia e faixa", () => {
    expect(overlaps(base, { weekdays: [4], startTime: "17:30", endTime: "18:30" })).toBe(true);
  });

  it("não acusa dias diferentes ou horários encostados", () => {
    expect(overlaps(base, { weekdays: [3], startTime: "17:00", endTime: "18:00" })).toBe(false);
    expect(overlaps(base, { weekdays: [2], startTime: "18:00", endTime: "19:00" })).toBe(false);
  });
});

const baseContext = {
  consent: "granted" as const,
  capacity: 20,
  activeCount: 5,
  waitlistCount: 0,
  alreadyEnrolled: false,
  activeInAnotherGroup: false,
};

describe("decideEnrollment", () => {
  it("matricula quando há vaga e consentimento", () => {
    expect(decideEnrollment(baseContext)).toEqual({ status: "active" });
  });

  it("bloqueia matrícula repetida na mesma turma", () => {
    expect(decideEnrollment({ ...baseContext, alreadyEnrolled: true })).toEqual({
      status: "blocked",
      reason: "already_enrolled",
    });
  });

  it("bloqueia consentimento revogado antes de olhar vaga", () => {
    expect(decideEnrollment({ ...baseContext, consent: "revoked", capacity: 1, activeCount: 1 })).toEqual({
      status: "blocked",
      reason: "consent_revoked",
    });
  });

  it("bloqueia segunda turma ativa", () => {
    expect(decideEnrollment({ ...baseContext, activeInAnotherGroup: true })).toEqual({
      status: "blocked",
      reason: "other_group_active",
    });
  });

  it("joga na lista de espera com a próxima posição quando a turma lotou", () => {
    expect(decideEnrollment({ ...baseContext, capacity: 20, activeCount: 20, waitlistCount: 3 })).toEqual({
      status: "waitlist",
      reason: "full",
      position: 4,
    });
  });

  it("deixa em rascunho sem consentimento de matrícula", () => {
    expect(decideEnrollment({ ...baseContext, consent: "missing" })).toEqual({
      status: "draft",
      reason: "consent_missing",
    });
  });

  it("lista de espera vence rascunho: sem vaga não há o que ativar", () => {
    expect(
      decideEnrollment({ ...baseContext, consent: "missing", activeCount: 20 }),
    ).toMatchObject({ status: "waitlist" });
  });
});

describe("resolveOverriddenEnrollment", () => {
  it("autoriza a exceção quando a turma tem vaga", () => {
    expect(resolveOverriddenEnrollment({ capacity: 20, activeCount: 5, waitlistCount: 0 })).toEqual({
      status: "active",
      position: null,
    });
  });

  it("mantém a fila quando a turma está cheia: exceção não compra vaga", () => {
    expect(resolveOverriddenEnrollment({ capacity: 1, activeCount: 1, waitlistCount: 2 })).toEqual({
      status: "waitlist",
      position: 3,
    });
  });
});

describe("seatsLeft e occupancyPercent", () => {
  it("nunca fica negativo nem passa de 100", () => {
    expect(seatsLeft(20, 3)).toBe(17);
    expect(seatsLeft(20, 25)).toBe(0);
    expect(occupancyPercent(20, 5)).toBe(25);
    expect(occupancyPercent(20, 25)).toBe(100);
    expect(occupancyPercent(0, 5)).toBe(100);
  });
});

describe("validOverrideReason", () => {
  it("exige motivo com conteúdo", () => {
    expect(validOverrideReason("")).toBe(false);
    expect(validOverrideReason("curto")).toBe(false);
    expect(validOverrideReason("  atleta de 2009 jogando Sub-13  ")).toBe(true);
  });
});
