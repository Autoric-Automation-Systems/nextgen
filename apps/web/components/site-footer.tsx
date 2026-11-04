import { DEV_CREDIT, devLogo, type Surface } from "@/lib/brand";

type Props = {
  surface?: Surface;
  /** Nome da escola; ausente no site do produto. */
  schoolName?: string;
};

/**
 * Rodapé com a assinatura do desenvolvedor.
 *
 * `rel="noopener noreferrer"` porque o destino é externo e abre em nova aba: sem isso a
 * página de destino recebe `window.opener` e o Referer com o caminho de onde o usuário veio.
 */
export function SiteFooter({ surface = "light", schoolName }: Props) {
  const logo = devLogo(surface);

  return (
    <footer className={`footer ${surface === "dark" ? "footer-dark" : ""}`}>
      <div className="wrap footer-inner">
        <span className="muted">
          {schoolName ? `${schoolName} · ` : ""}NextGen — gestão de escolas de futebol
        </span>

        <a
          className="footer-dev"
          href={DEV_CREDIT.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${DEV_CREDIT.name} — ${DEV_CREDIT.url}`}
        >
          <span className="muted">Desenvolvido por</span>
          <img
            src={logo.src}
            alt={logo.alt}
            height={20}
            width={Math.round(20 * logo.ratio)}
            style={{ display: "block", height: 20, width: "auto" }}
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
