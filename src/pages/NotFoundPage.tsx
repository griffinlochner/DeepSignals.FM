import { useEffect } from "react";
import PublicBrandIdent from "../components/PublicBrandIdent";
import PublicRadioWaveField from "../components/PublicRadioWaveField";
import PublicSiteFooter from "../components/PublicSiteFooter";
import "../styles/aboutPage.css";
import "../styles/notFoundPage.css";

function NotFoundPage() {
  useEffect(() => {
    document.documentElement.classList.add("not-found-page");
    document.body.classList.add("not-found-page");
    document.getElementById("root")?.classList.add("not-found-page");

    return () => {
      document.documentElement.classList.remove("not-found-page");
      document.body.classList.remove("not-found-page");
      document.getElementById("root")?.classList.remove("not-found-page");
    };
  }, []);

  return (
    <div className="about-page-shell not-found-shell">
      <PublicRadioWaveField />
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <main className="not-found-main">
        <div className="about-content-frame not-found-frame">
          <PublicBrandIdent className="not-found-ident" />

          <section
            className="not-found-content"
            aria-labelledby="not-found-title"
          >
            <p className="about-page__section-label about-page__label-pulse">
              XX // SIGNAL LOST
            </p>

            <h1 className="not-found-statement" id="not-found-title">
              <span className="about-associated-gradient-text">
                THE REQUESTED FREQUENCY
                <br />
                COULD NOT BE ACQUIRED.
              </span>
            </h1>

            <a
              className="not-found-home-link"
              href="/"
              aria-label="Return to the DeepSignals.FM home page"
            >
              RETURN HOME
            </a>
          </section>

          <PublicSiteFooter />
        </div>
      </main>
    </div>
  );
}

export default NotFoundPage;
