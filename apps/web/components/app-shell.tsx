"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

const NAV_ID = "shell-nav";
const COLLAPSE_KEY = "nextgen:nav-collapsed";

/**
 * Casca do painel com menu lateral retrátil no celular.
 *
 * No desktop o menu fica parado na coluna esquerda. Abaixo de 820px ele vira gaveta fora da
 * tela, aberta pelo botão do topo: o menu com oito itens empilhado acima do conteúdo
 * empurrava a primeira tela inteira para baixo.
 *
 * O estado vive aqui porque o botão (barra do topo) e a gaveta (`aside`) são irmãos — sem
 * um ancestral comum, um não alcançaria o outro. Fecha ao navegar, ao tocar fora e no Esc,
 * devolvendo o foco ao botão; com a gaveta aberta o miolo fica `inert`, para o Tab não
 * entrar em conteúdo coberto pelo véu.
 */
export function AppShell({
  aside,
  title,
  topbar,
  children,
}: {
  aside: ReactNode;
  title: string;
  topbar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Trocou de rota, a gaveta não tem mais por que existir.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Preferência lida depois da hidratação: o servidor não conhece o `localStorage`, e
  // renderizar recolhido no HTML daria diferença de markup em toda navegação.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      return !value;
    });
  };

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) toggleRef.current?.focus();
      wasOpen.current = false;
      return;
    }

    wasOpen.current = true;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    // A gaveta cobre a tela; deixar o documento rolar atrás dela embaralha o retorno.
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    // Girou o celular ou alargou a janela: a coluna fixa do desktop volta e a gaveta
    // ficaria aberta sobre uma tela que já tem menu — e com o miolo `inert`.
    const wide = window.matchMedia("(min-width: 821px)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", onWide);

    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div
      className="shell"
      data-nav-open={open ? "true" : "false"}
      data-nav-collapsed={collapsed ? "true" : "false"}
    >
      <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden />

      <aside id={NAV_ID} className="shell-side" aria-label="Menu do painel">
        <div className="shell-side-head">
          <button
            ref={closeRef}
            type="button"
            className="nav-close"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        {aside}
      </aside>

      <div className="shell-main" inert={open || undefined}>
        <div className="shell-top">
          <div className="shell-top-inner">
            <button
              ref={toggleRef}
              type="button"
              className="nav-toggle"
              aria-expanded={open}
              aria-controls={NAV_ID}
              onClick={() => setOpen((value) => !value)}
            >
              <span className="nav-toggle-bars" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              <span className="sr-only">Menu</span>
            </button>

            <span className="shell-mobile-title">{title}</span>

            <button
              type="button"
              className="nav-collapse"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls={NAV_ID}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                focusable="false"
              >
                <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
              </svg>
              <span className="sr-only">{collapsed ? "Expandir menu" : "Recolher menu"}</span>
            </button>

            {topbar}
          </div>
        </div>

        <main className="shell-content">{children}</main>

        <SiteFooter />
      </div>
    </div>
  );
}
