"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/financeiro", label: "Visão geral" },
  { href: "/financeiro/mensalidades", label: "Mensalidades" },
  { href: "/financeiro/despesas", label: "Despesas" },
  { href: "/financeiro/planos", label: "Planos" },
  { href: "/financeiro/envio", label: "Envio" },
  { href: "/financeiro/pix", label: "Pix" },
];

export function FinanceTabs() {
  const pathname = usePathname();

  return (
    <nav className="module-tabs" aria-label="Seções do financeiro">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
