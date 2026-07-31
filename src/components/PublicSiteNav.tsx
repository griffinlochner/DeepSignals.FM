import PublicBrandIdent from './PublicBrandIdent'
import './publicSiteNav.css'

type PublicSiteNavProps = {
  currentPage: 'home' | 'about'
}

function PublicSiteNav({ currentPage }: PublicSiteNavProps) {
  return (
    <header className="public-site-nav">
      <nav className="public-site-nav__bar" aria-label="Primary">
        <div className="public-site-nav__brand" aria-hidden="false">
          <PublicBrandIdent />
        </div>

        <div className="public-site-nav__links">
          <a
            className={`public-site-nav__link${currentPage === 'home' ? ' public-site-nav__link--active' : ''}`}
            href="/"
            aria-current={currentPage === 'home' ? 'page' : undefined}
          >
            HOME
          </a>
          <a
            className={`public-site-nav__link${currentPage === 'about' ? ' public-site-nav__link--active' : ''}`}
            href="/about/"
            aria-current={currentPage === 'about' ? 'page' : undefined}
          >
            ABOUT
          </a>
        </div>
      </nav>
    </header>
  )
}

export default PublicSiteNav