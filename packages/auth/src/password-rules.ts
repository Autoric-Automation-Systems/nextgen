/**
 * Regras de senha, sem banco e sem rede.
 *
 * O Better Auth valida tamanho mínimo e máximo; aqui ficam as regras que ele não tem e
 * que o usuário precisa ver em português, antes de a requisição sair. A mensagem é a
 * mesma que a tela mostra, então testar a função é testar o texto.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Lista curta de senhas que aparecem em qualquer ataque de força bruta.
 *
 * Curta de propósito: lista longa vira manutenção infinita e mensagem confusa. O que
 * importa é barrar o óbvio — "123456", o nome do produto, o nome do time.
 */
const OBVIOUS = new Set([
  "123456789",
  "1234567890",
  "senha1234",
  "senha12345",
  "password",
  "password1",
  "password123",
  "qwerty1234",
  "qwertyuiop",
  "abcd123456",
  "nextgen123",
  "nextgen2024",
  "nextgen2025",
  "nextgen2026",
  "futebol123",
  "corinthians",
  "flamengo",
  "saopaulo",
  "palmeiras",
  "vasco",
  "santos",
  "cruzeiro",
  "gremio",
  "internacional",
]);

export type PasswordVerdict = { ok: true } | { ok: false; message: string };

const OK: PasswordVerdict = { ok: true };

export function checkNewPassword(
  password: string,
  confirmation: string,
  email?: string,
): PasswordVerdict {
  if (password.length === 0) return { ok: false, message: "Informe uma senha." };

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.` };
  }

  if (password !== confirmation) {
    return { ok: false, message: "As duas senhas não são iguais." };
  }

  if (OBVIOUS.has(password.toLowerCase())) {
    return { ok: false, message: "Essa senha é fácil de adivinhar. Escolha outra." };
  }

  // O e-mail é público para quem vê a tela; a senha não pode ser a parte antes do @.
  const local = email?.split("@")[0]?.toLowerCase().trim();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return { ok: false, message: "A senha não pode conter o seu e-mail." };
  }

  return OK;
}
