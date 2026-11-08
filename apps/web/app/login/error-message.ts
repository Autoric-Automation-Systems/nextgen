/**
 * Motivo da falha, em texto que o responsável entende.
 *
 * O Better Auth devolve código em inglês (`new_user_signup_disabled`) na query. Mostrar
 * o código cru não diz o que fazer; mostrar nada faz o usuário repetir o mesmo pedido
 * indefinidamente.
 */
const MESSAGES: Record<string, string> = {
  new_user_signup_disabled:
    "Este e-mail ainda não tem acesso. Se a escola já cadastrou você, peça o link em «Primeiro acesso» — o cadastro é feito por ela, não pelo site.",
  invalid_token: "Este link já foi usado ou expirou. Peça um novo.",
  INVALID_TOKEN: "Este link já foi usado ou expirou. Peça um novo.",
  expired_token: "Este link expirou. Peça um novo.",
  user_not_found: "Não encontramos a conta deste e-mail. Fale com a escola.",
  failed_to_create_session: "Não foi possível abrir a sessão. Tente novamente.",
  "invalid origin": "O acesso foi aberto por um endereço não autorizado. Use o endereço oficial da escola.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  EMAIL_NOT_VERIFIED: "Este e-mail ainda não foi confirmado. Peça o link em «Primeiro acesso».",
  PASSWORD_TOO_SHORT: "A senha é curta demais. Use pelo menos 10 caracteres.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  PASSWORD_ALREADY_SET: "Esta conta já tem senha. Use «Esqueci minha senha» para trocá-la.",
};

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;

  return MESSAGES[code] ?? "Não foi possível concluir agora. Tente de novo ou fale com a escola.";
}
