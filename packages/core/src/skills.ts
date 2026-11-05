/**
 * Atributos do card (doc 08 §2). Quatro pilares, dezesseis atributos.
 *
 * O código é a chave estável: nome e peso podem mudar por escola, o código não. Sem isso,
 * renomear "Marcação" quebraria todo histórico de avaliação já lançado.
 */

export type Pillar = "technical" | "physical" | "tactical" | "behavioral";

export type Skill = {
  code: string;
  name: string;
  pillar: Pillar;
};

export const SKILLS: readonly Skill[] = [
  { code: "CTL", name: "Controle", pillar: "technical" },
  { code: "PAS", name: "Passe", pillar: "technical" },
  { code: "FIN", name: "Finalização", pillar: "technical" },
  { code: "DRI", name: "Drible", pillar: "technical" },
  { code: "VEL", name: "Velocidade", pillar: "physical" },
  { code: "AGI", name: "Agilidade", pillar: "physical" },
  { code: "RES", name: "Resistência", pillar: "physical" },
  { code: "FOR", name: "Força", pillar: "physical" },
  { code: "POS", name: "Posicionamento", pillar: "tactical" },
  { code: "DEF", name: "Marcação", pillar: "tactical" },
  { code: "VIS", name: "Leitura de jogo", pillar: "tactical" },
  { code: "MOV", name: "Movimentação", pillar: "tactical" },
  { code: "DIS", name: "Disciplina", pillar: "behavioral" },
  { code: "EQU", name: "Trabalho em equipe", pillar: "behavioral" },
  { code: "RESI", name: "Resiliência", pillar: "behavioral" },
  { code: "FOC", name: "Foco", pillar: "behavioral" },
] as const;

export const PILLARS: Record<Pillar, { label: string; short: string }> = {
  technical: { label: "Técnico", short: "TÉC" },
  physical: { label: "Físico", short: "FÍS" },
  tactical: { label: "Tático", short: "TÁT" },
  behavioral: { label: "Comportamental", short: "COM" },
};

const BY_CODE = new Map(SKILLS.map((skill) => [skill.code, skill]));

export function skillByCode(code: string): Skill | null {
  return BY_CODE.get(code.trim().toUpperCase()) ?? null;
}

/** Escala do doc 08 §3: 1 a 5, sem fração. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export type Score = { code: string; score: number };

/** Média dos scores de um pilar, em escala 1–5. `null` quando o pilar não foi avaliado. */
export function pillarAverage(scores: Iterable<Score>, pillar: Pillar): number | null {
  let total = 0;
  let count = 0;

  for (const entry of scores) {
    if (skillByCode(entry.code)?.pillar !== pillar) continue;
    total += entry.score;
    count += 1;
  }

  return count === 0 ? null : total / count;
}

/**
 * Índice interno de evolução, 0–100 (doc 08 §5). É o número do relatório, não do card.
 */
export function developmentIndex(scores: Iterable<Score>): number | null {
  const list = [...scores];
  if (list.length === 0) return null;

  const average = list.reduce((sum, entry) => sum + entry.score, 0) / list.length;
  return Math.round(((average - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100);
}

/**
 * Nota do card, 48–100 (doc 08 §5): `40 + (média - 1) × 15` sobre a média em 1–5.
 *
 * O piso é 40, não 48. O card só existe para 12+, mas o piso de 40, com média mínima 1,
 * dá 40 — a fórmula não deve ser corrigida aqui para "ficar bonita", ou o número deixa de
 * casar com o relatório.
 */
export function cardRating(scores: Iterable<Score>): number | null {
  const list = [...scores];
  if (list.length === 0) return null;

  const average = list.reduce((sum, entry) => sum + entry.score, 0) / list.length;
  return Math.round(40 + (average - SCORE_MIN) * 15);
}

/**
 * Se o número do card pode aparecer. Abaixo de 12 o card é de barras: um "OVR 62" numa
 * criança de 9 anos é ficção estatística e vira competição entre pais (doc 08 §5).
 */
export function canShowCardRating(age: number): boolean {
  return age >= 12;
}
