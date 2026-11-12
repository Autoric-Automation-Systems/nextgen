import type { PlayerCardData } from "@/components/player-card";

/**
 * Cards de exemplo da página inicial.
 *
 * Dado fictício, escrito aqui — não vem do banco, para a raiz continuar estática e não
 * depender de escola nenhuma existir. São dois de propósito: o de 13 anos mostra nota; o
 * de 11 mostra idade e só barras. A regra de faixa etária aparece na vitrine, não só no
 * texto de venda.
 */

/** Retrato da vitrine. `photo` só entra com liberação registrada (ver `release`). */
export type ShowcasePortrait = {
  src: string;
  alt: string;
  /** `illustration` não representa pessoa real e dispensa liberação. */
  kind: "illustration" | "photo";
  /** Fonte da imagem, obrigatória quando é foto. */
  credit?: string;
  /**
   * Prova de que o responsável autorizou o uso da imagem em peça comercial: quem assinou,
   * qual termo e quando. Foto de aluno de escola cliente entra aqui com o termo gerado pelo
   * próprio produto — o mesmo consentimento que a plataforma cobra não vale só para o app.
   */
  release?: { guardian: string; term: string; grantedOn: string };
};

export type ShowcaseCard = { portrait: ShowcasePortrait; data: PlayerCardData };

const BOY: ShowcasePortrait = {
  src: "/players/boy.svg",
  alt: "Retrato ilustrado de um aluno de uniforme",
  kind: "illustration",
};

const GIRL: ShowcasePortrait = {
  src: "/players/girl.svg",
  alt: "Retrato ilustrado de uma aluna de uniforme",
  kind: "illustration",
};

function card(portrait: ShowcasePortrait, data: Omit<PlayerCardData, "photo">): ShowcaseCard {
  return { portrait, data: { ...data, photo: { src: portrait.src, alt: portrait.alt } } };
}

const SCORES_13 = [
  { code: "CTL", score: 4 },
  { code: "PAS", score: 4 },
  { code: "FIN", score: 5 },
  { code: "DRI", score: 5 },
  { code: "VEL", score: 5 },
  { code: "AGI", score: 4 },
  { code: "RES", score: 4 },
  { code: "FOR", score: 3 },
  { code: "POS", score: 4 },
  { code: "DEF", score: 2 },
  { code: "VIS", score: 4 },
  { code: "MOV", score: 5 },
  { code: "DIS", score: 4 },
  { code: "EQU", score: 4 },
  { code: "RESI", score: 3 },
  { code: "FOC", score: 4 },
] as const;

const PREVIOUS_13 = [
  { code: "CTL", score: 4 },
  { code: "PAS", score: 4 },
  { code: "FIN", score: 4 },
  { code: "DRI", score: 4 },
  { code: "VEL", score: 4 },
  { code: "AGI", score: 4 },
  { code: "RES", score: 4 },
  { code: "FOR", score: 3 },
  { code: "POS", score: 4 },
  { code: "DEF", score: 2 },
  { code: "VIS", score: 4 },
  { code: "MOV", score: 4 },
  { code: "DIS", score: 4 },
  { code: "EQU", score: 4 },
  { code: "RESI", score: 3 },
  { code: "FOC", score: 4 },
] as const;

const SCORES_11 = [
  { code: "CTL", score: 4 },
  { code: "PAS", score: 5 },
  { code: "FIN", score: 3 },
  { code: "DRI", score: 4 },
  { code: "VEL", score: 4 },
  { code: "AGI", score: 5 },
  { code: "RES", score: 4 },
  { code: "FOR", score: 3 },
  { code: "POS", score: 4 },
  { code: "DEF", score: 3 },
  { code: "VIS", score: 5 },
  { code: "MOV", score: 4 },
  { code: "DIS", score: 5 },
  { code: "EQU", score: 5 },
  { code: "RESI", score: 4 },
  { code: "FOC", score: 4 },
] as const;

export const SHOWCASE_CARDS: ShowcaseCard[] = [
  card(BOY, {
    nickname: "Tiaguinho",
    team: "Sub-13",
    position: "Atacante",
    jerseyNumber: 11,
    age: 13,
    schoolName: "Escola Teste",
    cycleLabel: "2º ciclo",
    scores: [...SCORES_13],
    previousScores: [...PREVIOUS_13],
    badges: 7,
    consentNote: "perfil autorizado pelo responsável",
  }),
  card(GIRL, {
    nickname: "Bia",
    team: "Sub-11",
    position: "Meia",
    jerseyNumber: 10,
    age: 11,
    schoolName: "Escola Teste",
    cycleLabel: "2º ciclo",
    scores: [...SCORES_11],
    consentNote: "perfil autorizado pelo responsável",
  }),
];
