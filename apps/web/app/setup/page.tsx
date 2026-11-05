import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { usersExist } from "@/lib/first-run";
import { SetupForm } from "./setup-form";

// A decisão depende de quantos usuários existem agora: cachear a resposta entregaria o
// formulário depois do primeiro cadastro, e o insert falharia sem explicar por quê.
export const dynamic = "force-dynamic";

/**
 * Porta de entrada de uma instalação vazia. Existe porque `disableSignUp` impede que a
 * primeira conta nasça pelo login, e deixa o sistema num estado em que o e-mail chega e
 * o clique volta para `/login`. Com um usuário no banco, a rota desaparece.
 */
export default async function SetupPage() {
  if (await usersExist()) notFound();

  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/login", label: "Entrar" },
        ]}
      />
      <SetupForm />
      <SiteFooter />
    </>
  );
}
