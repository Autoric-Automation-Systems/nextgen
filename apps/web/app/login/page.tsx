import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "./login-form";

/** Aviso de sucesso vindo de outra tela: `?senha=1`, `?saida=1`. */
const NOTICES: Record<string, string> = {
  senha: "Senha definida. Entre com a senha nova.",
  saida: "Você saiu. Até a próxima.",
};

/**
 * A falha na verificação do link chega aqui como `?error=`, e não em `/dashboard`: a
 * rota autenticada exige sessão e redirecionaria para cá sem o parâmetro, que é
 * exatamente como "clicou e voltou para o login" ficava sem explicação.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; senha?: string; saida?: string; next?: string }>;
}) {
  const { error, senha, saida, next } = await searchParams;
  const notice = senha ? NOTICES.senha : saida ? NOTICES.saida : undefined;

  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/escola", label: "Para escolas" },
        ]}
      />
      <LoginForm error={error} notice={notice} next={next} />
      <SiteFooter />
    </>
  );
}
