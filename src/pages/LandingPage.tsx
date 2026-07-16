import LandingNexusScene from '../scenes/landing-nexus/LandingNexusScene'
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
            <a
              className="transmission-overlay__social-link transmission-overlay__social-link--facebook"
              href="https://www.facebook.com/people/DeepSignalsFM/61591116698277/#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit DeepSignals.FM on Facebook"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13.5 20v-7h2.3l.3-2.7h-2.6V3.8c0-.8.2-1.3 1.3-1.3h1.4V.1c-.2 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H7.7V13h2.4v7h3.4Z" />
              </svg>
            </a>
            <a
              className="transmission-overlay__social-link transmission-overlay__social-link--instagram"
              href="https://www.instagram.com/deepsignals.fm/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit DeepSignals.FM on Instagram"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                <circle cx="12" cy="12" r="4.2" />
                <circle cx="17.4" cy="6.6" r="1.1" />
              </svg>
            </a>
            <a
              className="transmission-overlay__social-link transmission-overlay__social-link--x"
              href="https://x.com/DeepSignalsFM"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit DeepSignals.FM on X"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.3 3H21l-6.4 7.3L22 21h-5.6l-4.4-5.7L6.8 21H4l6.8-7.8L2 3h5.7l4 5.3L18.3 3Zm-1 16.2h1.1L7 4.7H5.8l11.5 14.5Z" />
              </svg>
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}

export default LandingPage
