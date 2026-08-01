import PublicSocialLinks from './PublicSocialLinks'
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

      <PublicSocialLinks className="public-site-footer__socials" ariaLabel="social links" />
    </footer>
  )
}

export default PublicSiteFooter
