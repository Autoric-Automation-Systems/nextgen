import { createHash } from "node:crypto";
import { withTenant, type Prisma } from "@nextgen/db";
import {
  CONSENT_PURPOSES,
  PURPOSE_CODES,
  ageOn,
  canPublishPublicCard,
  decideEnrollment,
  type ConsentPurpose,
} from "@nextgen/core";

export type ConsentStatusView = "granted" | "revoked" | "missing";

export type PurposeView = {
  code: string;
  name: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  status: ConsentStatusView;
  grantedAt: string | null;
  revokedAt: string | null;
  termVersion: string | null;
  termBody: string | null;
};

export type StudentConsentView = {
  studentId: string;
  name: string;
  nickname: string | null;
  age: number;
  cardEnabled: boolean;
  classGroup: string | null;
  enrollmentStatus: string | null;
  purposes: PurposeView[];
  /** Finalidades obrigatórias ainda não autorizadas. */
  pending: string[];
};

export type ConsentContext = { schoolId: string; userId: string };

function labelOf(purpose: ConsentPurpose): string {
  return PURPOSE_LABELS[PURPOSE_CODES[purpose]]?.name ?? PURPOSE_CODES[purpose];
}

/** Ordem de leitura das finalidades: contrato primeiro, marketing por último. */
const PURPOSE_ORDER = Object.keys(CONSENT_PURPOSES) as ConsentPurpose[];
const PURPOSE_BY_CODE = new Map(PURPOSE_ORDER.map((purpose) => [PURPOSE_CODES[purpose], purpose]));

/**
 * Traduz o código gravado no banco (`public_card`) para a chave canônica do core
 * (`publicCard`). A tela e o formulário falam códigos; as regras falam chaves.
 */
export function resolvePurpose(code: string): ConsentPurpose | null {
  return PURPOSE_BY_CODE.get(code) ?? null;
}

/**
 * Visão de consentimento por aluno.
 *
 * Sem `studentIds`, lista a escola inteira — é o que a secretaria usa para cobrar as
 * pendências. Com `studentIds`, lista só os filhos do responsável logado: o escopo vem
 * da sessão, nunca da URL.
 */
export async function listConsents(
  ctx: ConsentContext,
  options: { studentIds?: string[]; onlyPending?: boolean } = {},
): Promise<StudentConsentView[]> {
  return withTenant(ctx, async (tx) => {
    const terms = await tx.consentTerm.findMany({
      where: { retiredAt: null, effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
      select: { purposeCode: true, version: true, bodyMarkdown: true },
    });
    // `orderBy` desc + primeiro por finalidade = versão vigente.
    const currentTerm = new Map<string, { version: string; bodyMarkdown: string }>();
    for (const term of terms) {
      if (!currentTerm.has(term.purposeCode)) {
        currentTerm.set(term.purposeCode, { version: term.version, bodyMarkdown: term.bodyMarkdown });
      }
    }

    const students = await tx.student.findMany({
      where: {
        deletedAt: null,
        ...(options.studentIds ? { id: { in: options.studentIds } } : {}),
        ...(options.onlyPending
          ? {
              OR: [
                { enrollments: { some: { status: "draft", deletedAt: null } } },
                { consents: { none: { purposeCode: "enrollment", status: "granted" } } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      take: 300,
      select: {
        id: true,
        fullName: true,
        nickname: true,
        birthDate: true,
        publicCardEnabled: true,
        consents: {
          orderBy: { grantedAt: "desc" },
          select: { purposeCode: true, status: true, grantedAt: true, revokedAt: true },
        },
        enrollments: {
          where: { deletedAt: null },
          orderBy: [{ status: "asc" }, { startsOn: "desc" }],
          take: 1,
          select: { status: true, classGroup: { select: { name: true } } },
        },
      },
    });

    const today = new Date();

    return students.map((student) => {
      // A mais recente de cada finalidade manda: reaceitar cria linha nova, revogar
      // fecha a antiga. `orderBy grantedAt desc` + `has` garante que a primeira vence.
      const latest = new Map<string, (typeof student.consents)[number]>();
      for (const consent of student.consents) {
        if (!latest.has(consent.purposeCode)) latest.set(consent.purposeCode, consent);
      }

      const purposes: PurposeView[] = PURPOSE_ORDER.map((purpose) => {
        const code = PURPOSE_CODES[purpose];
        const config = CONSENT_PURPOSES[purpose];
        const consent = latest.get(code);
        const term = currentTerm.get(code);

        return {
          code,
          name: purposeName(code),
          description: purposeDescription(code),
          required: config.required,
          sensitive: config.sensitive,
          status: consent?.status === "granted" ? "granted" : consent ? "revoked" : "missing",
          grantedAt: consent?.status === "granted" ? consent.grantedAt.toISOString() : null,
          revokedAt: consent?.revokedAt?.toISOString() ?? null,
          termVersion: term?.version ?? null,
          termBody: term?.bodyMarkdown ?? null,
        };
      });

      return {
        studentId: student.id,
        name: student.fullName,
        nickname: student.nickname,
        age: ageOn(student.birthDate, today),
        cardEnabled: student.publicCardEnabled,
        classGroup: student.enrollments[0]?.classGroup.name ?? null,
        enrollmentStatus: student.enrollments[0]?.status ?? null,
        purposes,
        pending: purposes.filter((purpose) => purpose.required && purpose.status !== "granted").map((p) => p.code),
      };
    });
  });
}

/**
 * Nomes e descrições vêm do banco (`consent_purposes`), mas a página precisa deles antes
 * de qualquer leitura de aluno. Consultar a tabela global para cada render é barato, porém
 * a lista é fixa e conhecida; manter aqui evita uma ida ao banco só para rótulo.
 */
function purposeName(code: string): string {
  return PURPOSE_LABELS[code]?.name ?? code;
}

function purposeDescription(code: string): string {
  return PURPOSE_LABELS[code]?.description ?? "";
}

export const PURPOSE_LABELS: Record<string, { name: string; description: string; consequence: string }> = {
  enrollment: {
    name: "Matrícula e acompanhamento",
    description: "Dados do aluno, turma, frequência e avaliações. Sem esta autorização a matrícula fica pendente.",
    consequence: "Revogar impede renovar a matrícula. A matrícula atual continua pelo contrato.",
  },
  image_internal: {
    name: "Fotos dentro da escola",
    description: "Registro de treino e evolução mostrado só para a família e a equipe.",
    consequence: "Revogar interrompe o uso interno; o material já entregue à família não é recolhido.",
  },
  image_public: {
    name: "Imagem em divulgação",
    description: "Fotos e vídeos no site, nas redes e no material de divulgação da escola.",
    consequence: "Revogar tira o material do ar e desliga o card público na hora.",
  },
  public_card: {
    name: "Card público do aluno",
    description: "Apelido, posição, habilidades e conquistas visíveis para quem tem o link. Só a partir de 12 anos.",
    consequence: "Revogar desliga o card imediatamente.",
  },
  health_anamnesis: {
    name: "Anamnese e prontuário",
    description: "Alergias, lesões e condições clínicas vistas apenas pela coordenação.",
    consequence: "Sem esta autorização a escola não registra prontuário e pede a ficha em papel.",
  },
  health_emergency: {
    name: "Kit de emergência",
    description: "Contatos e orientações de primeiros socorros usados em urgência por qualquer professor.",
    consequence: "Revogar deixa a escola sem orientação em caso de acidente durante o treino.",
  },
  marketing: {
    name: "Comunicações de marketing",
    description: "Novidades, promoções e matrícula aberta. Avisos operacionais continuam.",
    consequence: "Revogar interrompe só o envio promocional.",
  },
};

type ConsentTx = Prisma.TransactionClient;

/** Versão vigente de uma finalidade, ou `null` se a plataforma ainda não publicou o termo. */
async function currentTerm(tx: ConsentTx, purpose: string) {
  return tx.consentTerm.findFirst({
    where: { purposeCode: purpose, retiredAt: null, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, version: true, bodyHash: true },
  });
}

export type GrantInput = {
  purpose: ConsentPurpose;
  studentId: string;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Vínculo do usuário logado com o aluno.
 *
 * Não recebe `guardianId` de fora: quem chama é uma server action e o id viria do
 * formulário. Aqui o vínculo é provado no banco, e um responsável não alcança filho de
 * outra família nem por POST forjado.
 */
async function guardianLink(tx: ConsentTx, ctx: ConsentContext, studentId: string): Promise<string | null> {
  const guardian = await tx.guardian.findFirst({
    where: { userId: ctx.userId, deletedAt: null },
    select: { id: true },
  });
  if (!guardian) return null;

  const link = await tx.studentGuardian.findFirst({
    where: { studentId, guardianId: guardian.id },
    select: { id: true },
  });
  return link ? guardian.id : null;
}

export type ConsentChangeResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Registra uma autorização.
 *
 * A linha é imutável depois de criada (trigger `consents_guard_update`), então reaceitar
 * uma finalidade revogada **cria** uma linha nova — o histórico de revogação continua
 * visível e o `evidence_hash` de cada aceite fica preservado.
 */
export async function grantConsent(ctx: ConsentContext, input: GrantInput): Promise<ConsentChangeResult> {
  return withTenant(ctx, async (tx) => {
    const guardianId = await guardianLink(tx, ctx, input.studentId);
    if (!guardianId) return { status: "error", message: "Este aluno não está sob sua responsabilidade." };
    const code = PURPOSE_CODES[input.purpose];

    const student = await tx.student.findFirst({
      where: { id: input.studentId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        publicCardEnabled: true,
        consents: {
          where: { purposeCode: code },
          orderBy: { grantedAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    });
    if (!student) return { status: "error", message: "Aluno não encontrado." };

    if (student.consents[0]?.status === "granted") {
      // Repetir o aceite é no-op — menos para a matrícula. Rascunho criado depois do
      // aceite (aluno que trocou de turma) ficaria preso sem esta segunda chance.
      const healed =
        input.purpose === "enrollment"
          ? await activateDraftEnrollment(tx, input.studentId)
          : "";
      const base = `${labelOf(input.purpose)} já estava autorizado.`;
      return { status: "ok", message: healed ? `${base} ${healed}` : base };
    }

    const term = await currentTerm(tx, code);
    if (!term) {
      return {
        status: "error",
        message: "A plataforma ainda não publicou o termo desta finalidade. Fale com o suporte.",
      };
    }

    const now = new Date();
    // Evidência: texto aceito + aluno + finalidade + quem aceitou + quando. Muda se
    // qualquer um dos quatro mudar, e não guarda dado pessoal em claro.
    const evidenceHash = createHash("sha256")
      .update(`${term.bodyHash}:${student.id}:${code}:${ctx.userId}:${now.toISOString()}`)
      .digest("hex");

    await tx.consent.create({
      data: {
        schoolId: ctx.schoolId,
        studentId: student.id,
        guardianId,
        purposeCode: code,
        termId: term.id,
        status: "granted",
        grantedAt: now,
        evidenceHash,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        method: "portal",
      },
    });

    const messages: string[] = [];

    if (input.purpose === "enrollment") {
      messages.push(await activateDraftEnrollment(tx, student.id));
    }

    if (input.purpose === "publicCard" || input.purpose === "imagePublic") {
      messages.push(await syncCardState(tx, student.id, student.birthDate));
    }

    await tx.auditLog.create({
      data: {
        schoolId: ctx.schoolId,
        actorUserId: ctx.userId,
        actorRole: "guardian",
        action: "consent.grant",
        entity: "consent",
        entityId: `${student.id}:${code}`,
        after: { purpose: code, termVersion: term.version },
      },
    });

    const label = labelOf(input.purpose);
    return {
      status: "ok",
      message: [`${label}: autorizado.`, ...messages.filter(Boolean)].join(" "),
    };
  });
}

/**
 * Revogação com efeito imediato naquilo que o consentimento liberava.
 *
 * A matrícula **não** é cancelada: dado pedagógico já produzido continua pela base legal
 * do contrato (doc 02). O que cai na hora é a publicação — card público fora do ar, e a
 * escola passa a ver a pendência na lista.
 */
export async function revokeConsent(ctx: ConsentContext, input: GrantInput): Promise<ConsentChangeResult> {
  return withTenant(ctx, async (tx) => {
    const guardianId = await guardianLink(tx, ctx, input.studentId);
    if (!guardianId) return { status: "error", message: "Este aluno não está sob sua responsabilidade." };
    const code = PURPOSE_CODES[input.purpose];

    const granted = await tx.consent.findFirst({
      where: {
        studentId: input.studentId,
        guardianId,
        purposeCode: code,
        status: "granted",
      },
      orderBy: { grantedAt: "desc" },
      select: { id: true },
    });
    if (!granted) return { status: "error", message: "Não há autorização vigente para revogar." };

    await tx.consent.update({
      where: { id: granted.id },
      data: { status: "revoked", revokedAt: new Date() },
    });

    const messages: string[] = [];
    if (input.purpose === "publicCard" || input.purpose === "imagePublic") {
      const student = await tx.student.findFirst({
        where: { id: input.studentId },
        select: { publicCardEnabled: true, birthDate: true },
      });
      if (student?.publicCardEnabled) {
        await tx.student.update({ where: { id: input.studentId }, data: { publicCardEnabled: false } });
        messages.push("O card público saiu do ar agora.");
      }
    }

    await tx.auditLog.create({
      data: {
        schoolId: ctx.schoolId,
        actorUserId: ctx.userId,
        actorRole: "guardian",
        action: "consent.revoke",
        entity: "consent",
        entityId: `${input.studentId}:${code}`,
        after: { purpose: code },
      },
    });

    const label = labelOf(input.purpose);
    return { status: "ok", message: [`${label}: revogado.`, ...messages].join(" ") };
  });
}

/** Matrícula em rascunho vira ativa quando o termo chega — se ainda houver vaga. */
async function activateDraftEnrollment(tx: ConsentTx, studentId: string): Promise<string> {
  const enrollment = await tx.enrollment.findFirst({
    where: { studentId, status: "draft", deletedAt: null },
    orderBy: { startsOn: "desc" },
    select: { id: true, classGroupId: true, classGroup: { select: { name: true, capacity: true } } },
  });
  if (!enrollment) return "";

  const [activeCount, waitlistCount, otherActive] = await Promise.all([
    tx.enrollment.count({
      where: { classGroupId: enrollment.classGroupId, status: "active", deletedAt: null },
    }),
    tx.enrollment.count({
      where: { classGroupId: enrollment.classGroupId, status: "waitlist", deletedAt: null },
    }),
    // Duas matrículas ativas ao mesmo tempo é estado que a regra recusa criar; aqui a
    // segunda pode aparecer se a secretaria matriculou em outra turma enquanto o termo
    // não chegava.
    tx.enrollment.count({
      where: { studentId, status: "active", deletedAt: null, id: { not: enrollment.id } },
    }),
  ]);

  const decision = decideEnrollment({
    consent: "granted",
    capacity: enrollment.classGroup.capacity,
    activeCount,
    waitlistCount,
    alreadyEnrolled: false,
    activeInAnotherGroup: otherActive > 0,
  });

  if (decision.status === "active") {
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { status: "active" } });
    return `Matrícula em ${enrollment.classGroup.name} ativa.`;
  }

  if (decision.status === "waitlist") {
    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "waitlist", waitlistPosition: decision.position },
    });
    return `A turma ${enrollment.classGroup.name} está cheia: a matrícula entrou na lista de espera.`;
  }

  if (decision.status === "blocked") {
    return "O aluno já tem matrícula ativa em outra turma; a secretaria precisa resolver antes de liberar esta.";
  }

  return "";
}

/**
 * Card público só existe com as duas autorizações vigentes e idade mínima de 12.
 * Ligar aqui é o efeito de "autorizou o card"; desligar é o de "revogou a imagem".
 */
async function syncCardState(tx: ConsentTx, studentId: string, birthDate: Date): Promise<string> {
  const consents = await tx.consent.findMany({
    where: { studentId, purposeCode: { in: ["public_card", "image_public"] }, status: "granted" },
    select: { purposeCode: true },
  });
  const granted = new Set(consents.map((consent) => consent.purposeCode));

  const check = canPublishPublicCard({
    age: ageOn(birthDate, new Date()),
    optedIn: granted.has("public_card"),
    imagePublicConsent: granted.has("image_public") ? "granted" : "missing",
  });

  const student = await tx.student.findUnique({ where: { id: studentId }, select: { publicCardEnabled: true } });
  if (check.allowed && !student?.publicCardEnabled) {
    await tx.student.update({ where: { id: studentId }, data: { publicCardEnabled: true } });
    return "O card público está no ar.";
  }

  if (!check.allowed && student?.publicCardEnabled) {
    await tx.student.update({ where: { id: studentId }, data: { publicCardEnabled: false } });
    return "O card público saiu do ar.";
  }

  if (!check.allowed && check.reason === "under_12") {
    return "O card público só é liberado a partir dos 12 anos.";
  }
  if (!check.allowed && check.reason === "no_consent") {
    return "O card fica desligado enquanto faltar a autorização de imagem em divulgação.";
  }

  return "";
}
