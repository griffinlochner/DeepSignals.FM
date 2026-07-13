import CosmicNexusTheme from '../themes/cosmic-nexus/CosmicNexusTheme'
import '../styles/landingPage.css'

function LandingPage() {
  return (
    <div className="landing-page">
      <CosmicNexusTheme />

      <div className="signal-scene__vignette" aria-hidden="true" />
      <div className="signal-scene__scanlines" aria-hidden="true" />

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
      </main>
    </div>
  )
}

export default LandingPage
