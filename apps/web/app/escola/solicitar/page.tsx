import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { LeadForm } from "./lead-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Cadastrar escola — NextGen",
  description: "Peça o cadastro da sua escola de futebol no NextGen.",
};

export default function SolicitarPage() {
  return (
    <>
      <SiteHeader />

      <main className="wrap" style={{ padding: "40px 24px 64px" }}>
        <div className="auth-card" style={{ marginTop: 0, maxWidth: 520 }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Cadastrar escola</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>
            Contamos a estrutura, você confere se faz sentido e a escola entra no ar com os
            dados que já tem. O acesso é criado por nós — não há senha para vazar nem
            cadastro automático.
          </p>
          <LeadForm />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
