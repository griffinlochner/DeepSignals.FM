import { useEffect } from "react";
import PublicRadioWaveField from "../components/PublicRadioWaveField";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteNav from "../components/PublicSiteNav";
import PublicSocialLinks from "../components/PublicSocialLinks";
import "../styles/aboutPage.css";

function SubmissionsPage() {
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
    <div className="about-page-shell submissions-page">
      <PublicRadioWaveField />
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <PublicSiteNav currentPage="submissions" />

      <main className="about-page-main">
        <div className="about-content-frame">
          <section className="about-hero" aria-labelledby="submissions-open-title">
            <div className="about-hero__content">
              <p className="about-page__eyebrow about-page__label-pulse about-page__label-pulse--zero">
                00 // OPEN TRANSMISSION
              </p>
              <div className="about-section__copy">
                <p
                  className="about-hero__intro about-transmission-copy"
                  id="submissions-open-title"
                >
                  <span className="about-associated-gradient-text">
                    DeepSignals.FM is looking for psychedelic trance and
                    chillout transmissions from artists around the world.
                  </span>
                </p>
                <p className="about-transmission-copy">
                  <span className="about-associated-gradient-text">
                    All styles of psytrance are welcome — including forest,
                    darkpsy, full-on, hi-tech, progressive, psybient, psydub,
                    chillout, and everything between the frequencies.
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section className="about-section" aria-labelledby="submissions-looking-title">
            <p className="about-page__section-label about-page__label-pulse about-page__label-pulse--one">
              01 // WHAT WE&apos;RE LOOKING FOR
            </p>
            <div className="about-section__copy">
              <p className="about-transmission-copy" id="submissions-looking-title">
                <span className="about-associated-gradient-text">
                  Original tracks, released or unreleased music, DJ mixes, and
                  other psychedelic transmissions are welcome.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  High-quality audio is preferred. 320 kbps MP3, WAV, or FLAC
                  files are ideal and can be prepared for the DeepSignals.FM
                  broadcast stream.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Embedded album artwork is welcome too. DeepSignals.FM can
                  display artwork in the SIGNAL FEED and link listeners back to
                  your preferred artist page, label, store, or release.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section" aria-labelledby="submissions-permission-title">
            <p className="about-page__section-label about-page__label-pulse about-page__label-pulse--two">
              02 // PERMISSION TO TRANSMIT
            </p>
            <div className="about-section__copy">
              <p className="about-transmission-copy" id="submissions-permission-title">
                <span className="about-associated-gradient-text">
                  Please only submit music that you have permission to allow
                  DeepSignals.FM to play.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  If a label or another rights holder controls a release,
                  please let us know or confirm that the music can be included.
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Artists retain ownership of their music, and tracks can be
                  removed from DeepSignals.FM upon request.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section" aria-labelledby="submissions-send-title">
            <p className="about-page__section-label about-page__label-pulse about-page__label-pulse--three">
              03 // SEND THE SIGNAL
            </p>
            <div className="about-section__copy">
              <p className="about-transmission-copy" id="submissions-send-title">
                <span className="about-associated-gradient-text">
                  Interested in transmitting on DeepSignals.FM?
                </span>
              </p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  Send a short introduction, links to your music, and any tracks
                  or releases you&apos;d like us to consider.
                </span>
              </p>
              <p className="submissions-page__email">deepsignals.fm@gmail.com</p>
              <p className="about-transmission-copy">
                <span className="about-associated-gradient-text">
                  You can also contact DeepSignals.FM through our social media
                  channels.
                </span>
              </p>
              <PublicSocialLinks
                className="submissions-page__socials"
                ariaLabel="DeepSignals.FM social media channels"
              />
            </div>
          </section>

          <PublicSiteFooter />
        </div>
      </main>
    </div>
  );
}

export default SubmissionsPage;