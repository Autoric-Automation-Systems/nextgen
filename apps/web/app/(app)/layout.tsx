import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { Sidebar } from "@/components/sidebar";
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
  const label = session.isPlatformAdmin
    ? ROLE_LABEL.platform_support
    : ROLE_LABEL[workspace?.role ?? session.memberships[0]?.role ?? ""];

  return (
    <div className="shell">
      <aside className="shell-side">
        <Link href="/dashboard" style={{ padding: "0 10px" }} aria-label="Painel">
          <BrandLogo variant="mark" height={26} />
        </Link>

        <div className="shell-school">
          <strong>{workspace?.schoolName ?? "NextGen"}</strong>
          <span className="muted">{label ?? "Sem vínculo"}</span>
          {workspace?.isDemo ? <span className="badge warn shell-demo">demonstração</span> : null}
        </div>

        <Sidebar sections={sections} />

        {session.isPlatformAdmin ? (
          <p className="muted" style={{ marginTop: "auto", padding: "0 10px" }}>
            Você opera a plataforma. As seções de escola aparecem para suporte, em modo leitura.
          </p>
        ) : null}
      </aside>

      <div className="shell-main">
        <div className="shell-top">
          <div className="shell-top-inner">
            <span className="muted">
              {workspace?.isDemo
                ? "Dados fictícios de demonstração — nada aqui é de uma escola real."
                : "Dados da sua escola, filtrados por escola no banco."}
            </span>
            <div className="row" style={{ gap: 14 }}>
              <span className="muted">{session.email}</span>
              <form action={signOut}>
                <button className="btn btn-ghost" style={{ height: 34 }} type="submit">
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
