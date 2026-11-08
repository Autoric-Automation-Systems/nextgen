"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
              const inside = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const soon = item.status === "soon";
              const openChildren = item.children && inside;

              return (
                <li key={`${section.id}-${item.href}-${item.label}`}>
                  {soon ? (
                    <span className="sidebar-link is-soon" aria-disabled>
                      <span>{item.label}</span>
                      <em>em breve</em>
                    </span>
                  ) : item.external ? (
                    <a
                      className="sidebar-link"
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.hint}
                    >
                      <span>{item.label}</span>
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <Link
                      className={inside ? "sidebar-link is-active" : "sidebar-link"}
                      href={item.href}
                      aria-current={pathname === item.href ? "page" : undefined}
                      // `title` é a única superfície onde o `hint` cabe sem poluir o menu;
                      // o texto completo fica para quem precisa, no tooltip.
                      title={item.hint}
                    >
                      <span>{item.label}</span>
                    </Link>
                  )}

                  {/* A lista de um módulo só aparece dentro dele: fechada, o menu continua curto. */}
                  {openChildren ? (
                    <ul className="sidebar-sub">
                      {item.children!.map((child) => {
                        const childActive = child.exact
                          ? pathname === child.href
                          : pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <li key={child.href}>
                            <Link
                              className={childActive ? "sidebar-sublink is-active" : "sidebar-sublink"}
                              href={child.href}
                              aria-current={childActive ? "page" : undefined}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
