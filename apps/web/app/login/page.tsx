import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { usersExist } from "@/lib/first-run";
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
  // Sem escola, o link mágico não encontra usuário e a tela vira um beco sem saída.
  const needsSetup = !(await usersExist());

  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/escola", label: "Para escolas" },
        ]}
      />
      <LoginForm error={error} needsSetup={needsSetup} />
      <SiteFooter />
    </>
  );
}
