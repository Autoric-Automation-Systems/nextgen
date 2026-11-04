/**
 * Motivo da falha na verificação do link, em texto que o responsável entende.
 *
 * O Better Auth devolve código em inglês (`new_user_signup_disabled`) na query. Mostrar
 * o código cru não diz o que fazer; mostrar nada — que era o caso — faz o usuário repetir
 * o mesmo pedido de link indefinidamente.
 */
const MESSAGES: Record<string, string> = {
  new_user_signup_disabled:
    "Este e-mail ainda não tem acesso. Peça à escola para cadastrar seu login — o acesso é criado por ela, não pelo site.",
  invalid_token: "Este link já foi usado ou expirou. Peça um novo.",
  INVALID_TOKEN: "Este link já foi usado ou expirou. Peça um novo.",
  expired_token: "Este link expirou. Peça um novo.",
  user_not_found: "Não encontramos a conta deste e-mail. Fale com a escola.",
  failed_to_create_session: "Não foi possível abrir a sessão. Tente novamente.",
  "invalid origin": "O acesso foi aberto por um endereço não autorizado. Use o endereço oficial da escola.",
};

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;

  return MESSAGES[code] ?? "Não foi possível entrar com este link. Peça um novo ou fale com a escola.";
}
