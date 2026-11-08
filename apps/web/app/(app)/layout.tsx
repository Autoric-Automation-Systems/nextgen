import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Sidebar } from "@/components/sidebar";
import { SiteFooter } from "@/components/site-footer";
import { navSectionsFor } from "@/lib/nav";
import { resolveWorkspace } from "@/lib/workspace";
import { requireSession } from "@/lib/session";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administração da escola",
  coordinator: "Coordenação",
  teacher: "Professor",
  guardian: "Responsável",
  platform_support: "Administração da plataforma",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const workspace = await resolveWorkspace(session);

  const sections = navSectionsFor({ isPlatformAdmin: session.isPlatformAdmin, role: workspace?.role ?? null });
  // Quem opera a plataforma e também administra uma escola é as duas coisas: o rótulo do
  // vínculo vem primeiro, porque é ele que descreve o que a pessoa pode fazer ali. O selo
  // de plataforma continua visível ao lado.
  const label = ROLE_LABEL[workspace?.role ?? (session.isPlatformAdmin ? "platform_support" : "")] ?? "Sem vínculo";

  return (
    <div className="shell">
      <aside className="shell-side">
        <Link href="/dashboard" className="shell-brand" aria-label="Painel">
          <BrandLogo variant="mark" height={26} />
        </Link>

        <div className="shell-school">
          <strong>{workspace?.schoolName ?? "NextGen"}</strong>
          <span className="muted">{label}</span>
          {session.isPlatformAdmin ? <span className="badge shell-demo">plataforma</span> : null}
          {workspace?.isDemo ? <span className="badge warn shell-demo">demonstração</span> : null}
        </div>

        <Sidebar sections={sections} />

        {workspace?.readOnly ? (
          <p className="muted" style={{ marginTop: "auto", padding: "0 10px" }}>
            Você está vendo a plataforma, não uma escola sua: as seções aparecem em modo leitura.
          </p>
        ) : null}
      </aside>

      <div className="shell-main">
        <div className="shell-top">
          <div className="shell-top-inner">
            <span className="muted shell-note">
              {workspace?.isDemo
                ? "Dados fictícios de demonstração — nada aqui é de uma escola real."
                : "Dados da sua escola, filtrados por escola no banco."}
            </span>
            <div className="shell-account">
              <span className="muted shell-email">{session.email}</span>
              <form action={signOut}>
                <button className="btn btn-ghost" style={{ height: 34 }} type="submit">
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>

        <main className="shell-content">{children}</main>

        <SiteFooter />
      </div>
    </div>
  );
}
