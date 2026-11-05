import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export type HeaderLink = { href: string; label: string };

const DEFAULT_LINKS: HeaderLink[] = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/login", label: "Entrar" },
];

/**
 * Cabeçalho do site público.
 *
 * A marca é o caminho de volta para `/`: quem chega numa rota interna (login, cadastro)
 * precisa de uma saída óbvia antes de decidir se preenche o formulário. `Link` em vez de
 * `<a>` porque a navegação é interna e não deve recarregar a página.
 */
export function SiteHeader({ links = DEFAULT_LINKS }: { links?: HeaderLink[] }) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/" className="brand" aria-label="NextGen — início">
          <BrandLogo height={26} />
        </Link>
        <nav className="nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
