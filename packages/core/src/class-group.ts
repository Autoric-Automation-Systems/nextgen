/**
 * Turma e matrícula (doc 04 §3).
 *
 * Duas decisões governam este arquivo:
 *
 * 1. **Horário é regra de negócio, não texto livre.** A chamada, o plano de aula e o
 *    relatório do professor dependem de `weekdays` + `startTime`/`endTime` comparáveis.
 *    Guardar "Ter e Qui às 17h" inviabiliza a agenda.
 * 2. **Matrícula não é igual a vaga.** O aluno pode estar matriculado sem consentimento
 *    (rascunho), sem vaga (lista de espera) ou fora da categoria (exceção registrada).
 *    Cada um desses estados tem consequência jurídica e pedagógica diferente.
 */

export const WEEKDAYS = [
  { value: 0, short: "Dom", long: "domingo" },
  { value: 1, short: "Seg", long: "segunda" },
  { value: 2, short: "Ter", long: "terça" },
  { value: 3, short: "Qua", long: "quarta" },
  { value: 4, short: "Qui", long: "quinta" },
  { value: 5, short: "Sex", long: "sexta" },
  { value: 6, short: "Sáb", long: "sábado" },
] as const;

export type Schedule = {
  weekdays: number[];
  /** `HH:MM`, 24h. */
  startTime: string;
  endTime: string;
};

export type ScheduleIssue =
  | "no_weekday"
  | "invalid_weekday"
  | "duplicate_weekday"
  | "invalid_time"
  | "end_before_start"
  | "too_short"
  | "too_long";

export type ScheduleResult =
  | { ok: true; durationMinutes: number; weekdays: number[] }
  | { ok: false; issue: ScheduleIssue };

/** Minutos desde 00:00; `null` se não for `HH:MM` válido. */
export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Aula de 30 a 240 minutos. Abaixo de 30 não dá tempo de aquecer e treinar; acima de 4h
 * é erro de digitação ou acúmulo de turmas, e os dois casos quebram a agenda.
 */
export function validateSchedule(schedule: Schedule): ScheduleResult {
  const weekdays = [...new Set(schedule.weekdays)].sort((a, b) => a - b);

  if (weekdays.length === 0) return { ok: false, issue: "no_weekday" };
  if (weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return { ok: false, issue: "invalid_weekday" };
  }
  if (new Set(schedule.weekdays).size !== schedule.weekdays.length) {
    return { ok: false, issue: "duplicate_weekday" };
  }

  const start = parseTime(schedule.startTime);
  const end = parseTime(schedule.endTime);
  if (start === null || end === null) return { ok: false, issue: "invalid_time" };
  if (end <= start) return { ok: false, issue: "end_before_start" };

  const durationMinutes = end - start;
  if (durationMinutes < 30) return { ok: false, issue: "too_short" };
  if (durationMinutes > 240) return { ok: false, issue: "too_long" };

  return { ok: true, durationMinutes, weekdays };
}

const ISSUE_TEXT: Record<ScheduleIssue, string> = {
  no_weekday: "Escolha pelo menos um dia da semana.",
  invalid_weekday: "Dia da semana inválido.",
  duplicate_weekday: "Há dia repetido no horário.",
  invalid_time: "Use o horário no formato 17:00.",
  end_before_start: "O fim da aula precisa ser depois do início.",
  too_short: "Aula de menos de 30 minutos não dá tempo de treinar.",
  too_long: "Aula de mais de 4 horas — confira o horário.",
};

export function scheduleIssueText(issue: ScheduleIssue): string {
  return ISSUE_TEXT[issue];
}

function formatTime(value: string): string {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
}

/** `Ter/Qui · 17h–18h` — como a secretaria fala, sem inventar abreviação. */
export function formatSchedule(schedule: Schedule): string {
  const labels = schedule.weekdays
    .map((day) => WEEKDAYS.find((entry) => entry.value === day)?.short)
    .filter((label): label is NonNullable<typeof label> => Boolean(label));

  const days = labels.length > 0 ? labels.join("/") : "sem dia";
  return `${days} · ${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}`;
}

/** Duração em minutos, para conferir choque de horário em outra turma. */
export function overlaps(a: Schedule, b: Schedule): boolean {
  const shared = a.weekdays.some((day) => b.weekdays.includes(day));
  if (!shared) return false;

  const startA = parseTime(a.startTime);
  const endA = parseTime(a.endTime);
  const startB = parseTime(b.startTime);
  const endB = parseTime(b.endTime);
  if (startA === null || endA === null || startB === null || endB === null) return false;

  return startA < endB && startB < endA;
}

export type EnrollmentConsentStatus = "granted" | "missing" | "revoked";

export type EnrollmentContext = {
  consent: EnrollmentConsentStatus;
  capacity: number;
  activeCount: number;
  waitlistCount: number;
  /** Ano de nascimento do aluno dentro da faixa da categoria da turma. */
  categoryMatches: boolean;
  /** Já existe matrícula ativa nesta turma. */
  alreadyEnrolled: boolean;
  /** Já existe matrícula ativa em outra turma da mesma temporada. */
  activeInAnotherGroup: boolean;
};

export type EnrollmentDecision =
  | { status: "active" }
  | { status: "draft"; reason: "consent_missing" }
  | { status: "waitlist"; reason: "full"; position: number }
  | {
      status: "blocked";
      reason: "consent_revoked" | "category_mismatch" | "already_enrolled" | "other_group_active";
    };

/**
 * Decide o que acontece ao matricular. A ordem importa:
 *
 * 0. matrícula repetida na mesma turma bloqueia.
 * 1. consentimento revogado bloqueia — reativar sem novo termo seria tratar dado sem base.
 * 2. categoria e turma duplicada bloqueiam, mas aceitam exceção registrada.
 * 3. turma cheia vira lista de espera, com posição.
 * 4. sem consentimento de matrícula vira rascunho: o aluno aparece, nada é liberado.
 */
export function decideEnrollment(context: EnrollmentContext): EnrollmentDecision {
  if (context.alreadyEnrolled) {
    return { status: "blocked", reason: "already_enrolled" };
  }
  if (context.consent === "revoked") {
    return { status: "blocked", reason: "consent_revoked" };
  }
  if (!context.categoryMatches) {
    return { status: "blocked", reason: "category_mismatch" };
  }
  if (context.activeInAnotherGroup) {
    return { status: "blocked", reason: "other_group_active" };
  }
  if (context.activeCount >= context.capacity) {
    return { status: "waitlist", reason: "full", position: context.waitlistCount + 1 };
  }
  if (context.consent === "missing") {
    return { status: "draft", reason: "consent_missing" };
  }
  return { status: "active" };
}

/**
 * Situação depois que a coordenação autoriza uma exceção de categoria/turma.
 * A exceção muda quem pode entrar, não quantos cabem: sem vaga, o aluno entra na fila.
 */
export function resolveOverriddenEnrollment(context: {
  capacity: number;
  activeCount: number;
  waitlistCount: number;
}): { status: "active" | "waitlist"; position: number | null } {
  if (seatsLeft(context.capacity, context.activeCount) === 0) {
    return { status: "waitlist", position: context.waitlistCount + 1 };
  }
  return { status: "active", position: null };
}

export const BLOCKED_TEXT: Record<
  Extract<EnrollmentDecision, { status: "blocked" }>["reason"],
  string
> = {
  consent_revoked:
    "O responsável revogou o consentimento de matrícula. Registre um novo termo antes de matricular.",
  category_mismatch:
    "O ano de nascimento do aluno não está na faixa desta categoria. Matricule na turma certa ou registre a exceção.",
  other_group_active:
    "O aluno já tem matrícula ativa em outra turma desta temporada. Encerre a atual antes de transferir.",
  already_enrolled: "O aluno já está matriculado nesta turma.",
};

export function seatsLeft(capacity: number, activeCount: number): number {
  return Math.max(0, capacity - activeCount);
}

/** Percentual de ocupação, limitado a 100 — turma acima da capacidade não estoura a barra. */
export function occupancyPercent(capacity: number, activeCount: number): number {
  if (capacity <= 0) return 100;
  return Math.min(100, Math.round((activeCount / capacity) * 100));
}

export const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  draft: "rascunho",
  active: "ativa",
  waitlist: "lista de espera",
  suspended: "suspensa",
  cancelled: "cancelada",
  completed: "concluída",
};

/** Exceção de categoria/turma exige motivo escrito — auditoria sem motivo não audita nada. */
export const MIN_OVERRIDE_REASON = 10;

export function validOverrideReason(reason: string | undefined | null): boolean {
  return (reason ?? "").trim().length >= MIN_OVERRIDE_REASON;
}
