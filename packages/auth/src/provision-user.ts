import { authDb } from "./auth-db";

/**
 * Garante o `User` de quem foi cadastrado pela escola (responsável, professor, coordenação).
 *
 * O auto-cadastro está desligado (`disableSignUp`): quem cria conta é a escola. A escrita
 * passa pelo cliente dono das tabelas de autenticação por dois motivos independentes —
 * a política de `users` deixa o papel de aplicação apenas editar o próprio usuário
 * (`WITH CHECK id = app.current_user_id()`), e a leitura por e-mail precisa de quem ainda
 * não compartilha escola nenhuma com quem está cadastrando.
 */
export async function ensureUser(name: string, email: string): Promise<{ id: string }> {
  const normalized = email.trim().toLowerCase();

  const existing = await authDb.user.findFirst({
    where: { email: normalized },
    select: { id: true },
  });
  if (existing) return existing;

  try {
    return await authDb.user.create({
      data: { name: name.trim(), email: normalized },
      select: { id: true },
    });
  } catch (error) {
    // Duas secretarias cadastrando o mesmo responsável ao mesmo tempo: o índice único
    // responde primeiro, e a segunda leitura devolve o usuário que a outra criou.
    const raced = await authDb.user.findFirst({
      where: { email: normalized },
      select: { id: true },
    });
    if (raced) return raced;
    throw error;
  }
}
