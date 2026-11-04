import { SiteFooter } from "@/components/site-footer";
import { LoginForm } from "./login-form";

/**
 * A falha na verificação do link chega aqui como `?error=`, e não em `/dashboard`: a
 * rota autenticada exige sessão e redirecionaria para cá sem o parâmetro, que é
 * exatamente como "clicou e voltou para o login" ficava sem explicação.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <LoginForm error={error} />
      <SiteFooter />
    </>
  );
}
