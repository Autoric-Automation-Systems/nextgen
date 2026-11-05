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
        <div className="sidebar-section" key={section.id}>
          <p className="sidebar-title">{section.title}</p>
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const soon = item.status === "soon";

              return (
                <li key={`${section.id}-${item.href}-${item.label}`}>
                  {soon ? (
                    <span className="sidebar-link is-soon" aria-disabled>
                      <span>{item.label}</span>
                      <em>em breve</em>
                    </span>
                  ) : (
                    <Link
                      className={active ? "sidebar-link is-active" : "sidebar-link"}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{item.label}</span>
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
