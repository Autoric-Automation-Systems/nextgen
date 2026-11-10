/**
 * Ícones do menu, desenhados aqui e não importados de uma biblioteca.
 *
 * São dezesseis traços de 24px: uma dependência de pacote de ícones custaria mais bundle do
 * que o arquivo inteiro, e o menu é a única superfície que precisa deles — no modo recolhido
 * o ícone é o único rótulo, então ele precisa ser reconhecível sozinho.
 */
const PATHS: Record<string, string> = {
  "/dashboard": "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z",
  "/alunos": "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11l1.8 1.8L22 9.6",
  "/turmas": "M4 6h16M4 12h16M4 18h10",
  "/avaliacao": "M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5",
  "/pedagogia": "M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4V5.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 1-2 2v14a2 2 0 0 1 2-2h6V5.5Z",
  "/financeiro": "M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm0 0 2.5-4h13L21 8M16 14h2",
  "/site": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3Z",
  "/meus-boletos": "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  "/consentimentos": "M12 21s7-4.4 7-10V6l-7-3-7 3v5c0 5.6 7 10 7 10Zm-2.5-9.5 2 2 4-4",
  "/sistema": "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  "/sistema/card": "M4 6h16v12H4V6Zm0 4h16M8 15h4",
  "/sistema/email": "M3 6h18v12H3V6Zm0 .5 9 7 9-7",
  "/sistema/pedidos": "M8 4h8v3H8V4ZM5 7h14v14H5V7Zm4 6h6M9 17h4",
  "/ajuda": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2-12a2 2 0 1 1 3 1.7c-.7.4-1 1-1 1.8M12 17h.01",
  "/como-funciona": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5h.01",
  "https://www.autoric.com.br": "M14 4h6v6M20 4 10 14M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4",
};

const FALLBACK = "M4 6h16M4 12h16M4 18h16";

export function NavIcon({ href }: { href: string }) {
  return (
    <svg
      className="sidebar-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={PATHS[href] ?? FALLBACK} />
    </svg>
  );
}
