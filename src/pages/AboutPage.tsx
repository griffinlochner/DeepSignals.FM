import { useEffect } from 'react'
import PublicSiteNav from '../components/PublicSiteNav'
import '../styles/aboutPage.css'

function AboutPage() {
  useEffect(() => {
    document.documentElement.classList.add('about-page')
    document.body.classList.add('about-page')
    document.getElementById('root')?.classList.add('about-page')

    return () => {
      document.documentElement.classList.remove('about-page')
      document.body.classList.remove('about-page')
      document.getElementById('root')?.classList.remove('about-page')
    }
  }, [])

  return (
    <div className="about-page-shell">
      <div className="about-page-shell__signal-field" aria-hidden="true">
        <span className="about-page-shell__ring about-page-shell__ring--one" />
        <span className="about-page-shell__ring about-page-shell__ring--two" />
        <span className="about-page-shell__ring about-page-shell__ring--three" />
        <span className="about-page-shell__ring about-page-shell__ring--four" />
        <span className="about-page-shell__ring about-page-shell__ring--five" />
      </div>
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <PublicSiteNav currentPage="about" />

      <main className="about-page-main">
        <section className="about-hero" aria-labelledby="about-hero-title">
          <div className="about-hero__content">
            <p className="about-page__eyebrow">TRANSMISSION ORIGIN</p>

            <h1 className="about-hero__title" id="about-hero-title">
              <span className="about-hero__about">ABOUT</span>
              <span className="about-hero__deep">DEEP</span>
              <span className="about-hero__signals">SIGNALS</span>
              <span className="about-hero__dot">.</span>
              <span className="about-hero__fm">FM</span>
            </h1>

            <p className="about-hero__intro">
              An independent, ad-free psychedelic trance transmission.
            </p>
          </div>

          <div className="about-hero__visual" aria-hidden="true">
            <div className="about-hero__dish-reserve" />
          </div>
        </section>

        <section className="about-section about-section--origin" aria-labelledby="about-origin-title">
          <p className="about-page__section-label">01 // ORIGIN OF TRANSMISSION</p>
          <div className="about-section__copy">
            <p id="about-origin-title">
              Somewhere between distant stations, scattered psytrance playlists, and late-night searches through the outer reaches of the internet, a signal began to form.
            </p>
          </div>
        </section>

        <section className="about-section about-section--mission" aria-labelledby="about-mission-title">
          <p className="about-page__section-label">02 // MISSION VECTOR</p>
          <div className="about-section__copy about-section__copy--wide">
            <h2 className="about-section__statement" id="about-mission-title">
              TRANSMITTING PSYTRANCE BEYOND THE STARS
            </h2>
          </div>
        </section>

        <section className="about-section about-section--closing" aria-labelledby="about-closing-title">
          <div className="about-section__copy about-section__copy--closing">
            <h2 className="about-section__closing-title" id="about-closing-title">
              THE SIGNAL IS STILL FORMING...
            </h2>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AboutPage