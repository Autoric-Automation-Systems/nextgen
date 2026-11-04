/**
 * Regras de consentimento e regime etário (LGPD art. 14 + ECA Digital art. 24).
 *
 * Este arquivo é a tradução executável do doc 02. Se mudar aqui, atualize o doc.
 */

export const CONSENT_PURPOSES = {
  enrollment: { required: true, sensitive: false },
  imageInternal: { required: false, sensitive: false },
  imagePublic: { required: false, sensitive: false },
  publicCard: { required: false, sensitive: false },
  healthAnamnesis: { required: false, sensitive: true },
  healthEmergency: { required: false, sensitive: true },
  marketing: { required: false, sensitive: false },
} as const;

export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;

export const PURPOSE_CODES: Record<ConsentPurpose, string> = {
  enrollment: "enrollment",
  imageInternal: "image_internal",
  imagePublic: "image_public",
  publicCard: "public_card",
  healthAnamnesis: "health_anamnesis",
  healthEmergency: "health_emergency",
  marketing: "marketing",
};

/** Regimes do doc 02 §2. */
export type AgeRegime = "child" | "teen" | "own_account" | "adult";

export function ageRegime(age: number): AgeRegime {
  if (age < 12) return "child";
  if (age < 16) return "teen";
  if (age < 18) return "own_account";
  return "adult";
}

/** Antes dos 16 não existe login próprio: a conta âncora é sempre do responsável. */
export function canHoldOwnLogin(age: number): boolean {
  return age >= 16;
}

/**
 * Consentimento de menor de 12 precisa ser específico e em destaque (art. 14 §1º),
 * com destaque visual e sem vir pré-marcado.
 */
export function requiresHighlightedConsent(age: number): boolean {
  return age < 12;
}

export type ConsentState = {
  purpose: ConsentPurpose;
  status: "granted" | "revoked" | "expired" | "missing";
};

export type EnrollmentConsentCheck = {
  allowed: boolean;
  missing: string[];
  blockedBy: string[];
};

/**
 * A matrícula só exige o consentimento obrigatório (`enrollment`). Qualquer outra
 * finalidade é opcional e **não pode** bloquear a matrícula (LGPD art. 8º: consentimento
 * não pode ser condição para o serviço além do necessário).
 */
export function checkEnrollmentConsent(states: ConsentState[]): EnrollmentConsentCheck {
  const byPurpose = new Map(states.map((s) => [s.purpose, s.status]));
  const missing: string[] = [];
  const blockedBy: string[] = [];

  for (const [purpose, config] of Object.entries(CONSENT_PURPOSES) as [
    ConsentPurpose,
    (typeof CONSENT_PURPOSES)[ConsentPurpose],
  ][]) {
    const status = byPurpose.get(purpose) ?? "missing";
    if (config.required && status !== "granted") {
      missing.push(PURPOSE_CODES[purpose]);
    }
    if (config.sensitive && status === "revoked") {
      blockedBy.push(PURPOSE_CODES[purpose]);
    }
  }

  return {
    allowed: missing.length === 0 && blockedBy.length === 0,
    missing,
    blockedBy,
  };
}

export type PublicCardCheck = {
  allowed: boolean;
  reason?: "under_12" | "no_consent" | "revoked" | "not_opt_in";
};

/**
 * Card público: nunca para menor de 12, sempre opt-in, sempre revogável e sempre
 * dependente de consentimento de imagem pública vigente.
 */
export function canPublishPublicCard(input: {
  age: number;
  optedIn: boolean;
  imagePublicConsent: ConsentState["status"];
}): PublicCardCheck {
  if (input.age < 12) return { allowed: false, reason: "under_12" };
  if (!input.optedIn) return { allowed: false, reason: "not_opt_in" };
  if (input.imagePublicConsent === "revoked") return { allowed: false, reason: "revoked" };
  if (input.imagePublicConsent !== "granted") return { allowed: false, reason: "no_consent" };
  return { allowed: true };
}

/** O comportamento nunca entra no card público (doc 08). */
export function isPubliclyVisibleSkill(pillar: "technical" | "physical" | "tactical" | "behavioral"): boolean {
  return pillar !== "behavioral";
}
