import { useEffect } from "react";
import PublicRadioWaveField from "../components/PublicRadioWaveField";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteNav from "../components/PublicSiteNav";
import TransmissionHeading from "../components/TransmissionHeading";
import "../styles/aboutPage.css";

function UpdatesPage() {
  useEffect(() => {
    document.documentElement.classList.add("about-page");
    document.body.classList.add("about-page");
    document.getElementById("root")?.classList.add("about-page");

    return () => {
      document.documentElement.classList.remove("about-page");
      document.body.classList.remove("about-page");
      document.getElementById("root")?.classList.remove("about-page");
    };
  }, []);

  return (
    <div className="about-page-shell updates-page">
      <PublicRadioWaveField />
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <PublicSiteNav currentPage="updates" />

      <main className="about-page-main">
        <div className="about-content-frame">
          <section className="about-hero" aria-labelledby="updates-title">
            <div className="about-hero__content">
              <h1
                className="public-page__title about-associated-gradient-text"
                id="updates-title"
              >
                UPDATES
              </h1>
              <p className="about-page__eyebrow public-page__subtitle about-page__label-pulse about-page__label-pulse--zero">
                TRANSMISSION LOG
              </p>
              <p className="about-hero__intro about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Development notes, signal discoveries, system changes, and
                  known anomalies from the evolving DeepSignals.FM transmission
                  network.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section" aria-labelledby="update-02-title">
            <h2
              className="about-page__section-label about-page__transmission-heading about-page__label-pulse about-page__label-pulse--one"
              id="update-02-title"
            >
              <TransmissionHeading
                sequence="02"
                metadata="2026-08-23"
                title="PLAYER SYSTEMS UPDATE"
              />
            </h2>
            <div className="about-section__copy updates-page__entry-copy">
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The DeepSignals.FM experimental player has received its largest interface and visual-systems update since coming online.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Recent development has focused on making the player clearer, more responsive, more consistent across screen sizes, and easier to explore while preserving the dense signal-console aesthetic.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Major changes include:
                </span>
              </p>
              <ul className="updates-page__list about-transmission-copy">
                <li><span className="about-associated-gradient-text">The former separate <strong>FEED</strong> and <strong>TELEMETRY</strong> controls have been consolidated into a unified <strong>INFO</strong> panel. Artwork, live signal telemetry, source links, station information, and DeepSignals messaging now live in one companion display.</span></li>
                <li><span className="about-associated-gradient-text"><strong>INFO</strong> now adapts between full and compact layouts while keeping album artwork square and undistorted. Energy, bass, kick, mids, and highs can be monitored without overwhelming the main player controls.</span></li>
                <li><span className="about-associated-gradient-text"><strong>CHROMA</strong>, <strong>MOTION</strong>, and <strong>INFO</strong> now share a cleaner unified control row with improved responsive behavior across desktop, portrait mobile, and landscape mobile layouts.</span></li>
                <li><span className="about-associated-gradient-text">The player interface has received a broader visual polish pass, including redesigned playback controls, improved sliders, clearer focus states, refined DeepSignals color treatment, and more consistent control geometry.</span></li>
                <li><span className="about-associated-gradient-text">The player glass itself can now participate in the <strong>CHROMA</strong> system, allowing subtle music-reactive color to move through the interface while labels and controls remain readable.</span></li>
                <li><span className="about-associated-gradient-text">Mobile and short-landscape layouts received extensive fixes. Player controls and <strong>INFO</strong> remain reachable without destructive clipping, oversized panels, or inaccessible content when device orientation changes.</span></li>
                <li><span className="about-associated-gradient-text">The player now preserves individual listener preferences including signal, visual environment, volume, <strong>CHROMA</strong>, <strong>MOTION</strong>, and <strong>INFO</strong> state.</span></li>
                <li><span className="about-associated-gradient-text">First-time listeners now arrive at a more representative DeepSignals experience: Illustrator — Psychedelic Experience is loaded as the initial demo signal, The Signal Nexus is selected as the initial environment, <strong>CHROMA</strong> and <strong>MOTION</strong> are enabled, <strong>INFO</strong> is open, and playback remains paused until the listener starts the transmission.</span></li>
              </ul>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The visual environment system has also received substantial work.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Signal Runner was streamlined after its experimental cockpit-interface work informed the design of the main player. Race to the Signal Nexus has received major motion, <strong>CHROMA</strong>, speed, and <strong>SURGE</strong> refinements, while The Signal Nexus has been rebuilt as a flagship environment with a reactive geometric core, flowing signal paths, music-driven energy traffic, a deeper star field, and qualified <strong>SURGE</strong> events capable of producing large supernova-like reactions.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Numerous smaller regressions and edge cases have also been corrected throughout the player, including <strong>INFO</strong> close/reopen behavior, responsive overflow, landscape-phone reachability, control alignment, icon rendering, and environment-switching stability.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The player remains experimental, and compatibility limitations documented below still apply to some browsers and devices.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The signal is evolving.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section" aria-labelledby="update-01-title">
            <h2
              className="about-page__section-label about-page__transmission-heading about-page__label-pulse about-page__label-pulse--one"
              id="update-01-title"
            >
              <TransmissionHeading
                sequence="01"
                metadata="2026-08-16"
                title="KNOWN SIGNAL LIMITATIONS"
              />
            </h2>
            <div className="about-section__copy updates-page__entry-copy">
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Testing has identified a compatibility limitation affecting <strong>live external radio signals in Safari and iOS browsers</strong>.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  External stations continue to play normally, but the browser
                  does not provide usable live audio-analysis data to the
                  player. As a result, features that depend on that signal
                  analysis — including <strong>CHROMA</strong>, audio-reactive <strong>MOTION</strong>, and live <strong>TELEMETRY</strong> — may not respond while listening to an external radio stream.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Local MP3 demo tracks continue to support these reactive
                  features normally.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The <strong>volume control is also currently ineffective on iOS devices</strong> and may not alter playback volume as expected.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Live radio reactivity has been confirmed working in desktop <strong>Chrome, Firefox, and Edge</strong>. Safari on macOS and browsers tested on iOS are currently affected.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  <strong>Android compatibility remains unverified.</strong>
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The signal is still transmitting.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section" aria-labelledby="update-00-title">
            <h2
              className="about-page__section-label about-page__transmission-heading about-page__label-pulse about-page__label-pulse--two"
              id="update-00-title"
            >
              <TransmissionHeading
                sequence="00"
                metadata="2026-08-16"
                title="PLAYER SIGNAL ONLINE"
              />
            </h2>
            <div className="about-section__copy updates-page__entry-copy">
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The first public DeepSignals.FM experimental player is now
                  online.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  The player can transmit audio from built-in <strong>local MP3 demo tracks</strong> or connect to <strong>external signals</strong> from independent psychedelic trance radio stations across the internet.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Listeners can currently:
                </span>
              </p>
              <ul className="updates-page__list about-transmission-copy">
                <li><span className="about-associated-gradient-text">Select between available local and external signal sources.</span></li>
                <li><span className="about-associated-gradient-text">Start, stop, and control the volume of the active transmission. The volume control also influences the intensity of audio-reactive <strong>CHROMA</strong> and <strong>MOTION</strong> effects.</span></li>
                <li><span className="about-associated-gradient-text">Switch between visual <strong>ENVIRONMENTS</strong> designed to react to playback and audio analysis.</span></li>
                <li><span className="about-associated-gradient-text">Toggle <strong>CHROMA</strong> to enable audio-reactive color behavior in supported environments.</span></li>
                <li><span className="about-associated-gradient-text">Toggle <strong>MOTION</strong> to enable environment movement and audio-reactive visual effects where supported.</span></li>
                <li><span className="about-associated-gradient-text">Toggle <strong>SIGNAL FEED</strong> to show or hide information and artwork associated with the current transmission.</span></li>
                <li><span className="about-associated-gradient-text">Toggle <strong>TELEMETRY</strong> to inspect live audio-analysis data such as overall energy and frequency activity across the incoming signal.</span></li>
              </ul>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Some environments use generated imagery and depth information
                  to create reactive three-dimensional scenes, while others —
                  such as The Signal Nexus — use their own real-time
                  visual systems.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  This is an early experimental version of the player. More
                  signals, environments, visual systems, and transmission
                  controls are still to come.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  <strong>SIGNAL ACQUIRED. PLAYER ONLINE.</strong>
                </span>
              </p>
            </div>
          </section>

          <PublicSiteFooter />
        </div>
      </main>
    </div>
  );
}

export default UpdatesPage;