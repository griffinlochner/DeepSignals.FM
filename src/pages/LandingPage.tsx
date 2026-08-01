import LandingNexusScene from '../scenes/landing-nexus/LandingNexusScene'
import PublicSocialIcon from '../components/PublicSocialIcon'
import { PUBLIC_SOCIAL_LINKS } from '../components/publicSocialLinks'
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
          <span>::</span> DeepSignals.FM <span>TRANSMISSION INITIALIZING</span> <span>::</span>
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
          <div className="transmission-overlay__social-links">
            {PUBLIC_SOCIAL_LINKS.map((socialLink) => (
              <a
                key={socialLink.network}
                className={`transmission-overlay__social-link transmission-overlay__social-link--${socialLink.network}`}
                href={socialLink.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={socialLink.ariaLabel}
              >
                <PublicSocialIcon network={socialLink.network} />
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default LandingPage
