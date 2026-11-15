/**
 * Regras de unidade e sala, sem banco.
 *
 * A unidade é o endereço que o responsável lê no boleto e no card ("onde deixo o aluno").
 * Guardar CEP como texto livre produz "01310-100", "01310100" e "0131010" na mesma escola,
 * e nenhum deles serve para abrir o mapa. Aqui tudo é reduzido a uma forma só antes de
 * chegar ao banco.
 */

/** 27 unidades federativas. `EX` não existe: é o que o usuário digita achando que existe. */
export const UF_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type UnitInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

/** Só dígitos. CEP é 8 números; hífen e ponto são enfeite de digitação. */
export function normalizeZip(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata para leitura: `01310100` → `01310-100`. */
export function formatZip(value: string): string {
  const digits = normalizeZip(value);
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function normalizeState(value: string): string {
  return value.trim().toUpperCase();
}

export function validState(value: string): boolean {
  return (UF_CODES as readonly string[]).includes(normalizeState(value));
}

/** Primeiro problema do cadastro de unidade, ou `null` se está tudo certo. */
export function unitIssue(input: UnitInput): string | null {
  if (input.name.trim().length < 2) return "Dê um nome à unidade: “Unidade Centro”, “Campo da Vila”.";
  if (input.name.trim().length > 60) return "O nome da unidade passa de 60 caracteres.";
  if (input.address.trim().length < 5) return "Informe o endereço com rua e número.";
  if (input.address.trim().length > 160) return "O endereço passa de 160 caracteres.";
  if (input.city.trim().length < 2) return "Informe a cidade.";
  if (!validState(input.state)) return "Informe a UF com duas letras (SP, RJ, MG…).";
  if (normalizeZip(input.zip).length !== 8) return "O CEP tem 8 dígitos.";
  return null;
}

/** Sala existe dentro de uma unidade e tem capacidade explícita: é o que limita a turma. */
export function roomIssue(input: { name: string; capacity: number }): string | null {
  if (input.name.trim().length < 2) return "Dê um nome à sala: “Campo 1”, “Quadra coberta”.";
  if (input.name.trim().length > 60) return "O nome da sala passa de 60 caracteres.";
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 200) {
    return "A capacidade da sala vai de 1 a 200 alunos.";
  }
  return null;
}

/** Tipos de sala, na ordem em que o formulário os mostra. Puro: o formulário é de cliente. */
export const ROOM_KINDS = [
  { value: "field", label: "Campo" },
  { value: "court", label: "Quadra" },
  { value: "gym", label: "Ginásio" },
  { value: "classroom", label: "Sala de aula" },
] as const;
