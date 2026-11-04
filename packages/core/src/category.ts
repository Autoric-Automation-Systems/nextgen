/**
 * Faixa etária e categoria (Sub-8, Sub-9…).
 *
 * A regra do futebol de base é por **ano de nascimento**, não por idade exata:
 * uma criança nascida em 2018 joga Sub-8 em 2026 mesmo que já tenha feito 8 anos
 * em abril. Usar idade exata criaria caso de dois alunos da mesma turma em
 * categorias diferentes no meio da temporada.
 */

export type Category = {
  id: string;
  name: string;
  birthYearFrom: number | null;
  birthYearTo: number | null;
};

export type DerivedCategory =
  | { ok: true; categoryId: string; outOfRange: false }
  | { ok: false; reason: "no_match" | "ambiguous"; candidates: string[] };

export function birthYear(birthDate: Date): number {
  return birthDate.getUTCFullYear();
}

/** Idade em anos completos na data de referência, em UTC (evita off-by-one por fuso). */
export function ageOn(birthDate: Date, reference: Date): number {
  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = reference.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}

export function matchesCategory(birthDate: Date, category: Category): boolean {
  const year = birthYear(birthDate);
  if (category.birthYearFrom === null || category.birthYearTo === null) return false;
  return year >= category.birthYearFrom && year <= category.birthYearTo;
}

export function deriveCategory(birthDate: Date, categories: Category[]): DerivedCategory {
  const candidates = categories.filter((c) => matchesCategory(birthDate, c));

  if (candidates.length === 0) {
    return { ok: false, reason: "no_match", candidates: [] };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: "ambiguous", candidates: candidates.map((c) => c.id) };
  }
  return { ok: true, categoryId: candidates[0]!.id, outOfRange: false };
}

/**
 * Categoria sugerida pelo nome (`Sub-8` → ano de nascimento). Serve para o admin
 * criar as categorias de uma temporada sem digitar 12 faixas na mão.
 */
export function suggestBirthYearRange(categoryName: string, seasonYear: number): { from: number; to: number } | null {
  const match = /sub[-\s]?(\d{1,2})/i.exec(categoryName);
  if (!match) return null;
  const age = Number(match[1]);
  if (!Number.isInteger(age) || age < 4 || age > 20) return null;
  const year = seasonYear - age;
  return { from: year, to: year };
}
