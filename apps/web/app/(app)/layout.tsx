import Link from "next/link";
import { requireSession } from "@/lib/session";
import { signOut } from "@/app/login/actions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administração",
  coordinator: "Coordenação",
  teacher: "Professor",
  guardian: "Responsável",
  platform_support: "Suporte NextGen",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <span className="brand-mark">NG</span>
            <span>
              {session.memberships.find((m) => m.schoolId === session.schoolId)?.schoolName ?? "NextGen"}
              <span className="muted" style={{ display: "block", fontWeight: 400, fontSize: 12 }}>
                {ROLE_LABEL[session.actor.kind === "member" || session.actor.kind === "guardian" ? session.actor.role : ""]}
              </span>
            </span>
          </div>

          <nav className="nav">
            <Link href="/dashboard">Painel</Link>
            <Link href="/alunos">Alunos</Link>
            <form action={signOut}>
              <button className="btn btn-ghost" style={{ height: 34 }} type="submit">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="wrap" style={{ padding: "32px 24px 72px" }}>
        {children}
      </main>
    </>
  );
}
