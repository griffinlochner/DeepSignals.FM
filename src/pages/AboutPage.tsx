import { useEffect } from "react";
import PublicRadioWaveField from "../components/PublicRadioWaveField";
import PublicSiteFooter from "../components/PublicSiteFooter";
import PublicSiteNav from "../components/PublicSiteNav";
import TransmissionHeading from "../components/TransmissionHeading";
import "../styles/aboutPage.css";

function AboutPage() {
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
    <div className="about-page-shell">
      <PublicRadioWaveField />
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <PublicSiteNav currentPage="about" />

      <main className="about-page-main">
        <div className="about-content-frame">
          <section className="about-hero">
            <div className="about-hero__content">
              <h1 className="public-page__title about-associated-gradient-text">
                ABOUT
              </h1>
              <p className="about-page__eyebrow public-page__subtitle about-page__label-pulse about-page__label-pulse--zero">
                TRANSMISSION PROFILE
              </p>
              <p className="about-page__eyebrow about-page__transmission-heading about-page__label-pulse about-page__label-pulse--zero">
                <TransmissionHeading
                  sequence="00"
                  title="INCOMING TRANSMISSION:"
                />
              </p>

              <p className="about-hero__intro about-transmission-copy">
                <span className="about-associated-gradient-text">
                  DeepSignals.FM is an independent, ad-free psychedelic trance
                  transmission, broadcasting from the outer reaches of the
                  internet to the farthest corners of the galaxy. We are a
                  community of psytrance enthusiasts, dedicated to sharing the
                  music we love and connecting with listeners around the world.
                </span>
              </p>
            </div>

            <div className="about-hero__visual" aria-hidden="true">
              <div className="about-hero__dish-reserve" />
            </div>
          </section>

          <section
            className="about-section about-section--origin"
            aria-labelledby="about-origin-title"
          >
            <p className="about-page__section-label about-page__transmission-heading about-page__label-pulse about-page__label-pulse--one">
              <TransmissionHeading
                sequence="01"
                title="ORIGIN OF TRANSMISSION"
              />
            </p>
            <div className="about-section__copy">
              <p className="about-transmission-copy" id="about-origin-title">
                <span className="about-associated-gradient-text">
                  Somewhere between distant stations, scattered psytrance
                  playlists, and late-night searches through the outer reaches
                  of the internet, a signal began to form.
                </span>
              </p>
            </div>
          </section>

          <section
            className="about-section about-section--mission"
            aria-labelledby="about-mission-title"
          >
            <p className="about-page__section-label about-page__transmission-heading about-page__label-pulse about-page__label-pulse--two">
              <TransmissionHeading sequence="02" title="MISSION VECTOR" />
            </p>
            <div className="about-section__copy about-section__copy--wide">
              <h2
                className="about-section__statement about-transmission-copy"
                id="about-mission-title"
              >
                <span className="about-associated-gradient-text">
                  TRANSMITTING PSYTRANCE BEYOND THE STARS...
                </span>
              </h2>
            </div>
          </section>

          <PublicSiteFooter />
        </div>
      </main>
    </div>
  );
}

export default AboutPage;
