"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import type { NavSection } from "@/lib/nav";

/**
 * Menu lateral. Recebe as seções já filtradas pelo servidor — o componente não decide
 * quem vê o quê, apenas desenha. Filtro no cliente seria esconder link, não autorizar.
 */
export function Sidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="sidebar" aria-label="Seções">
      {sections.map((section) => (
        <div
          className={section.id === "ajuda" ? "sidebar-section is-help" : "sidebar-section"}
          key={section.id}
        >
          <p className="sidebar-title">{section.title}</p>
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const soon = item.status === "soon";

              return (
                <li key={`${section.id}-${item.href}-${item.label}`}>
                  {soon ? (
                    <span className="sidebar-link is-soon" aria-disabled>
                      <NavIcon href={item.href} />
                      <span className="sidebar-text">{item.label}</span>
                      <em className="sidebar-extra">em breve</em>
                    </span>
                  ) : item.external ? (
                    <a
                      className="sidebar-link"
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.hint}
                    >
                      <NavIcon href={item.href} />
                      <span className="sidebar-text">{item.label}</span>
                      <span className="sidebar-extra" aria-hidden>↗</span>
                    </a>
                  ) : (
                    <Link
                      className={active ? "sidebar-link is-active" : "sidebar-link"}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      // `title` é a única superfície onde o `hint` cabe sem poluir o menu;
                      // o texto completo fica para quem precisa, no tooltip.
                      title={item.hint}
                    >
                      <NavIcon href={item.href} />
                      <span className="sidebar-text">{item.label}</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
