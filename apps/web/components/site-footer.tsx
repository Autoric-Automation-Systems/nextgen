import { DEV_CREDIT, type Surface } from "@/lib/brand";

type Props = {
  surface?: Surface;
  /** Nome da escola; ausente no site do produto. */
  schoolName?: string;
};

/** O wordmark é baixo e largo: a 20px as hastes finas somem. */
const FOOTER_LOGO_HEIGHT = 22;

/**
 * Rodapé com a assinatura do desenvolvedor.
 *
 * `rel="noopener noreferrer"` porque o destino é externo e abre em nova aba: sem isso a
 * página de destino recebe `window.opener` e o Referer com o caminho de onde o usuário veio.
 */
export function SiteFooter({ surface = "light", schoolName }: Props) {
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
            className="footer-dev-logo"
            src={DEV_CREDIT.logo.src}
            alt={DEV_CREDIT.logo.alt}
            height={FOOTER_LOGO_HEIGHT}
            width={Math.round(FOOTER_LOGO_HEIGHT * DEV_CREDIT.logo.ratio)}
            style={{ display: "block", height: FOOTER_LOGO_HEIGHT, width: "auto" }}
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
