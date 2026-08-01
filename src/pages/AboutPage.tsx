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
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--one about-page-shell__ring--tone-indigo" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--two about-page-shell__ring--tone-cyan" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--three about-page-shell__ring--accent-neon" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--four about-page-shell__ring--tone-violet" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--five about-page-shell__ring--accent-salmon" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--six about-page-shell__ring--tone-cyan" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--seven about-page-shell__ring--accent-lavender" />
        <span className="about-page-shell__ring about-page-shell__ring--left about-page-shell__ring--eight about-page-shell__ring--tone-indigo" />

        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--one about-page-shell__ring--tone-violet" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--two about-page-shell__ring--tone-cyan" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--three about-page-shell__ring--accent-salmon" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--four about-page-shell__ring--tone-indigo" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--five about-page-shell__ring--accent-neon" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--six about-page-shell__ring--tone-cyan" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--seven about-page-shell__ring--accent-lavender" />
        <span className="about-page-shell__ring about-page-shell__ring--right about-page-shell__ring--eight about-page-shell__ring--tone-violet" />
      </div>
      <div className="about-page-shell__noise" aria-hidden="true" />
      <div className="about-page-shell__aura" aria-hidden="true" />

      <PublicSiteNav currentPage="about" />

      <main className="about-page-main">
        <div className="about-content-frame">
          <section className="about-hero" aria-labelledby="about-hero-title">
            <div className="about-hero__content">
              <p className="about-page__eyebrow about-page__label-pulse about-page__label-pulse--zero">00 // INCOMING TRANSMISSION:</p>

              <h1 className="about-hero__title" id="about-hero-title">
                <span className="about-hero__about">ABOUT</span>
                <span className="about-hero__deep">DEEP</span>
                <span className="about-hero__signals">SIGNALS</span>
                <span className="about-hero__dot">.</span>
                <span className="about-hero__fm">FM</span>
              </h1>

              <p className="about-hero__intro about-transmission-copy">
                <span className="about-associated-gradient-text">
                  DeepSignals.FM is an independent, ad-free psychedelic trance transmission, broadcasting from the outer reaches of the internet to the farthest corners of the galaxy. We are a community of psytrance enthusiasts, dedicated to sharing the music we love and connecting with listeners around the world.
                </span>
              </p>
            </div>

            <div className="about-hero__visual" aria-hidden="true">
              <div className="about-hero__dish-reserve" />
            </div>
          </section>

          <section className="about-section about-section--origin" aria-labelledby="about-origin-title">
            <p className="about-page__section-label about-page__label-pulse about-page__label-pulse--one">01 // ORIGIN OF TRANSMISSION</p>
            <div className="about-section__copy">
              <p className="about-transmission-copy" id="about-origin-title">
                <span className="about-associated-gradient-text">
                  Somewhere between distant stations, scattered psytrance playlists, and late-night searches through the outer reaches of the internet, a signal began to form.
                </span>
              </p>
            </div>
          </section>

          <section className="about-section about-section--mission" aria-labelledby="about-mission-title">
            <p className="about-page__section-label about-page__label-pulse about-page__label-pulse--two">02 // MISSION VECTOR</p>
            <div className="about-section__copy about-section__copy--wide">
              <h2 className="about-section__statement about-transmission-copy" id="about-mission-title">
                <span className="about-associated-gradient-text">
                  TRANSMITTING PSYTRANCE BEYOND THE STARS...
                </span>
              </h2>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default AboutPage