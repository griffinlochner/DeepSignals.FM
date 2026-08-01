import LandingNexusScene from '../scenes/landing-nexus/LandingNexusScene'
import PublicBrandIdent from '../components/PublicBrandIdent'
import PublicSocialLinks from '../components/PublicSocialLinks'
import '../styles/landingPage.css'

function LandingPage() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="landing-page">
      <LandingNexusScene reducedMotion={reducedMotion} />

      <div className="landing-nexus-scene__vignette" aria-hidden="true" />
      <div className="landing-nexus-scene__scanlines" aria-hidden="true" />

      <main className="transmission-overlay">
        <p className="transmission-overlay__acquired">░▒▓ SIGNAL ACQUIRED ▓▒░</p>

        <h1 className="transmission-overlay__title">
          <span className="transmission-overlay__title-prefix">::</span>
          <PublicBrandIdent as="span" className="transmission-overlay__brand-ident" />
          <span className="transmission-overlay__title-initializing">TRANSMISSION INITIALIZING</span>
          <span className="transmission-overlay__title-suffix">::</span>
        </h1>

        <div className="transmission-overlay__status">
          <p>[ calibrating frequencies... ]</p>
          <p>[ tuning cosmic bandwidth... ]</p>
          <p>[ searching for hidden wavelengths... ]</p>
        </div>

        <p className="transmission-overlay__message">
          A new psychedelic trance radio experience is awakening...
        </p>

        <div className="transmission-overlay__socials" aria-label="social links">
          <p className="transmission-overlay__social-label">Stay connected:</p>
          <PublicSocialLinks className="transmission-overlay__social-links" ariaLabel="social links" />
        </div>
      </main>
    </div>
  )
}

export default LandingPage
