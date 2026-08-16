import { useEffect } from "react";
import PublicRadioWaveField from "../components/PublicRadioWaveField";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteNav from "../components/PublicSiteNav";
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
                className="updates-page__title about-associated-gradient-text"
                id="updates-title"
              >
                UPDATES
              </h1>
              <p className="about-page__eyebrow about-page__label-pulse about-page__label-pulse--zero">
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

          <section className="about-section" aria-labelledby="update-01-title">
            <h2
              className="about-page__section-label about-page__label-pulse about-page__label-pulse--one"
              id="update-01-title"
            >
              01 // 2026-08-16 // KNOWN SIGNAL LIMITATIONS
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
              className="about-page__section-label about-page__label-pulse about-page__label-pulse--two"
              id="update-00-title"
            >
              00 // 2026-08-16 // PLAYER SIGNAL ONLINE
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
                  such as the Cosmic Signal Nexus — use their own real-time
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