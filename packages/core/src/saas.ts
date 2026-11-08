/**
 * Assinatura da escola com a NextGen (doc 12).
 *
 * São dois dinheiros que nunca se cruzam: a escola cobra a mensalidade do responsável na
 * conta dela (Pix copia-e-cola, doc 07) e paga a NextGen pela assinatura do produto. O
 * valor da assinatura vem daqui, dos alunos ativos, e é o único que passa por gateway —
 * porque aí o dinheiro entra na conta da NextGen, como deve ser.
 *
 * Preço em centavos, tabela em código e não no banco: mudar preço é decisão de produto com
 * deploy, e o histórico do que já foi cobrado fica na fatura, não na tabela.
 */

export type SaasPlanCode = "campo" | "escola" | "clube";

export type SaasPlan = {
  code: SaasPlanCode;
  name: string;
  /** Faixa de alunos ativos, em texto para a tela. */
  range: string;
  /** Até que número de alunos o plano alcança; `null` = sem teto. */
  maxStudents: number | null;
  /** Valor fixo mensal, quando o plano não é por aluno. */
  flatCents: number | null;
  /** Valor por aluno ativo, quando o plano é por aluno. */
  perStudentCents: number | null;
  /** Piso mensal dos planos por aluno. */
  minCents: number | null;
};

export const SAAS_PLANS: SaasPlan[] = [
  {
    code: "campo",
    name: "Campo",
    range: "até 80 alunos",
    maxStudents: 80,
    flatCents: 19_900,
    perStudentCents: null,
    minCents: null,
  },
  {
    code: "escola",
    name: "Escola",
    range: "81 a 300 alunos",
    maxStudents: 300,
    flatCents: null,
    perStudentCents: 350,
    minCents: 34_900,
  },
  {
    code: "clube",
    name: "Clube",
    range: "300+ alunos ou multi-unidade",
    maxStudents: null,
    flatCents: null,
    perStudentCents: 280,
    minCents: 89_900,
  },
];

export const TRIAL_DAYS = 14;

export function saasPlan(code: string): SaasPlan | null {
  return SAAS_PLANS.find((plan) => plan.code === code) ?? null;
}

/**
 * Plano sugerido pela quantidade de alunos ativos. Serve para a tela propor, não para
 * trocar sozinha: mudar de plano mexe na fatura de alguém, e isso é decisão da escola.
 */
export function suggestedPlan(activeStudents: number): SaasPlan {
  const fit = SAAS_PLANS.find((plan) => plan.maxStudents === null || activeStudents <= plan.maxStudents);
  return fit ?? SAAS_PLANS[SAAS_PLANS.length - 1]!;
}

/** Valor mensal do plano para N alunos ativos. Arredonda para cima no centavo. */
export function planPriceCents(code: string, activeStudents: number): number {
  const plan = saasPlan(code);
  if (!plan) throw new Error(`plano desconhecido: ${code}`);
  if (plan.flatCents !== null) return plan.flatCents;

  const students = Math.max(0, Math.floor(activeStudents));
  const raw = students * (plan.perStudentCents ?? 0);
  return Math.max(raw, plan.minCents ?? 0);
}

export type SaasStatus = "trialing" | "active" | "past_due" | "canceled";

export const SAAS_STATUS_LABEL: Record<SaasStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
};

export function daysLeftInTrial(trialEndsAt: Date | null, today: Date): number | null {
  if (!trialEndsAt) return null;
  const diff = trialEndsAt.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** Vencimento do próximo ciclo: mesmo dia do mês, preso ao último dia quando não existe. */
export function nextPeriodEnd(from: Date, months = 1): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(year, month, Math.min(from.getUTCDate(), lastDay), 0, 0, 0, 0),
  );
}

/** Estado que a tela mostra, considerando o teste que venceu sem virar assinatura. */
export function effectiveStatus(status: SaasStatus, trialEndsAt: Date | null, today: Date): SaasStatus {
  if (status !== "trialing" || !trialEndsAt) return status;
  return trialEndsAt.getTime() < today.getTime() ? "past_due" : status;
}

/**
 * Primeiro vencimento da assinatura: o fim do teste quando ele ainda vale; hoje quando já
 * passou. Cobrar no meio do teste é o jeito mais rápido de perder a escola.
 */
export function firstDueDate(trialEndsAt: Date | null, today: Date): Date {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!trialEndsAt) return start;
  return trialEndsAt.getTime() > start.getTime() ? trialEndsAt : start;
}
