import PublicSocialIcon from './PublicSocialIcon'
import { PUBLIC_SOCIAL_LINKS } from './publicSocialLinks'
import './publicSiteFooter.css'

function PublicSiteFooter() {
  return (
    <footer className="public-site-footer" aria-label="Transmission footer">
      <div className="public-site-footer__divider" aria-hidden="true" />

      <p className="public-site-footer__end-label about-page__section-label about-page__label-pulse">
        // END OF TRANSMISSION //
      </p>

      <p className="public-site-footer__copyright" aria-label="Copyright 2026 DeepSignals.FM">
        <span className="public-site-footer__copyright-prefix">© 2026 </span>
        <span className="public-site-footer__brand" aria-hidden="true">
          <span className="public-site-footer__deep">DEEP</span>
          <span className="public-site-footer__signals">SIGNALS</span>
          <span className="public-site-footer__dot">.</span>
          <span className="public-site-footer__fm">FM</span>
        </span>
      </p>

      <div className="public-site-footer__socials" aria-label="social links">
        {PUBLIC_SOCIAL_LINKS.map((socialLink) => (
          <a
            key={socialLink.network}
            className={`public-site-footer__social-link public-site-footer__social-link--${socialLink.network}`}
            href={socialLink.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={socialLink.ariaLabel}
          >
            <PublicSocialIcon network={socialLink.network} />
          </a>
        ))}
      </div>
    </footer>
  )
}

export default PublicSiteFooter
