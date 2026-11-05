/**
 * Regras do primeiro acesso por e-mail.
 *
 * O login não cria conta (`disableSignUp`), então numa instalação sem nenhum usuário o
 * link chega e o clique morre em `new_user_signup_disabled`: ninguém entra. Em vez de
 * exigir SQL antes do primeiro acesso, o próprio login prepara o terreno quando uma das
 * duas condições vale: a instalação está vazia ou o e-mail está na lista de
 * administradores da plataforma.
 *
 * Ficam aqui, sem Postgres, porque são a parte que decide *se* grava. A gravação está em
 * `bootstrap-admin.ts`.
 */

export const TEST_SCHOOL = {
  tradeName: "Escola Teste",
  legalName: "Escola Teste Ltda",
  slug: "escola-teste",
} as const;

/**
 * Um aluno de exemplo, para o painel não abrir vazio depois do primeiro acesso.
 *
 * Sem responsável e sem consentimento de propósito: são justamente os registros que
 * dependem de um adulto real concordando, e inventá-los ensinaria o fluxo errado.
 */
export const TEST_STUDENT = {
  fullName: "Aluno Teste",
  nickname: "Teste",
  birthDate: "2015-03-10",
  position: "atacante",
  jerseyNumber: 10,
} as const;

export type BootstrapInput = {
  /** Quantos usuários existem no banco. */
  totalUsers: number;
  /** O e-mail está em `PLATFORM_ADMIN_EMAILS`? */
  allowlisted: boolean;
  userExists: boolean;
  /** O usuário já tem vínculo com alguma escola? */
  hasMembership: boolean;
};

/**
 * `none` = não mexer. `create` = criar usuário e escola de teste. `attach` = o usuário
 * existe (criado por SQL, por exemplo) mas não tem vínculo; vira admin de uma escola.
 *
 * Instalação vazia aceita qualquer e-mail: é o mesmo risco que `/setup` já corre, e não
 * há dado de ninguém para proteger antes do primeiro cadastro.
 */
export type BootstrapDecision = "none" | "create" | "attach";

export function decideBootstrap({
  totalUsers,
  allowlisted,
  userExists,
  hasMembership,
}: BootstrapInput): BootstrapDecision {
  if (userExists) {
    if (hasMembership) return "none";
    return allowlisted ? "attach" : "none";
  }

  return allowlisted || totalUsers === 0 ? "create" : "none";
}

/** `ruy.junior+dev@gmail.com` → `Ruy Junior`. */
export function adminNameFromEmail(email: string): string {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const words = local
    .replace(/^[0-9]+[+_-]?/, "")
    .split(/[._-]+/)
    .filter((word) => word.length > 0 && !/^\d+$/.test(word));

  if (words.length === 0) return "Administrador";

  return words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
}

/**
 * Slug livre a partir do nome da escola de teste.
 *
 * A tabela `schools` tem índice único em `slug`, e não dá para consultar antes: sem
 * contexto de tenant a política de RLS esconde as escolas existentes, inclusive do dono.
 * Então o insert seguinte tenta o próximo nome em vez de perguntar.
 */
export function slugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
