import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ResetForm } from "./reset-form";

/**
 * O Better Auth manda o link para `/api/auth/reset-password/:token`, que valida e
 * redireciona para cá com `?token=…` ou `?error=INVALID_TOKEN`. A validação fica lá
 * porque só o servidor conhece o token; aqui só existe o formulário.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const usable = Boolean(token) && !error;

  return (
    <>
      <SiteHeader
        links={[
          { href: "/como-funciona", label: "Como funciona" },
          { href: "/escola", label: "Para escolas" },
        ]}
      />

      {usable && token ? (
        <ResetForm token={token} />
      ) : (
        <main>
          <div className="wrap auth-main">
            <div className="card auth-card">
              <h2 style={{ margin: "0 0 8px", fontSize: 22, letterSpacing: "-0.02em" }}>
                Link expirado
              </h2>
              <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
                Este link de senha já foi usado ou passou do prazo. Peça outro — leva um
                minuto e o anterior deixa de valer.
              </p>
              <Link className="btn" href="/esqueci-senha" style={{ width: "100%" }}>
                Pedir novo link
              </Link>
            </div>
          </div>
        </main>
      )}

      <SiteFooter />
    </>
  );
}
