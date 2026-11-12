/**
 * Idade do aluno.
 *
 * A idade é sempre derivada da data de nascimento, em UTC: guardar "8 anos" exigiria
 * atualização diária e erraria na virada do ano. O futebol de base fala por ano de
 * nascimento ("Sub-9 é 2017"), mas o produto não guarda mais a faixa de categoria —
 * quem nomeia a turma é a escola.
 */

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
