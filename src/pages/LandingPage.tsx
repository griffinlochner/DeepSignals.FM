import LandingNexusScene from "../scenes/landing-nexus/LandingNexusScene";
import PublicBrandIdent from "../components/PublicBrandIdent";
import PublicSocialLinks from "../components/PublicSocialLinks";
import "../styles/landingPage.css";

function LandingPage() {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  return (
    <div className="landing-page">
      <LandingNexusScene reducedMotion={reducedMotion} />

      <div className="landing-nexus-scene__vignette" aria-hidden="true" />
      <div className="landing-nexus-scene__scanlines" aria-hidden="true" />

      <main className="transmission-overlay">
        <h1 className="transmission-overlay__title">
          <PublicBrandIdent
            as="span"
            className="transmission-overlay__brand-ident"
          />
          <span className="transmission-overlay__title-initializing">
            TRANSMISSION INITIALIZING
          </span>
        </h1>

        <div className="transmission-overlay__status">
          <p>[ calibrating frequencies... ]</p>
        </div>

        <div className="transmission-overlay__player-cta">
          <div className="player-cta__header">
            <span className="player-cta__led" aria-hidden="true" />
            <span className="player-cta__status">
              EXPERIMENTAL SIGNAL ONLINE
            </span>
          </div>

          <a href="/player/" className="player-cta__link">
            <span className="player-cta__link-text">TUNE INTO THE PLAYER</span>
            <span className="player-cta__arrow" aria-hidden="true">
              →
            </span>
          </a>

          <p className="player-cta__support">
            live stations · reactive visuals · telemetry · early preview
          </p>
        </div>

        <div
          className="transmission-overlay__socials"
          aria-label="social links"
        >
          <p className="transmission-overlay__social-label">Stay connected:</p>
          <PublicSocialLinks
            className="transmission-overlay__social-links"
            ariaLabel="social links"
          />
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
