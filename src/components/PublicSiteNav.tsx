import PublicBrandIdent from './PublicBrandIdent'
import './publicSiteNav.css'

type PublicSiteNavProps = {
  currentPage: 'about' | 'submissions'
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
            className={`public-site-nav__link${currentPage === 'about' ? ' public-site-nav__link--active' : ''}`}
            href="/about/"
            aria-current={currentPage === 'about' ? 'page' : undefined}
          >
            ABOUT
          </a>
          <a
            className={`public-site-nav__link${currentPage === 'submissions' ? ' public-site-nav__link--active' : ''}`}
            href="/submissions/"
            aria-current={currentPage === 'submissions' ? 'page' : undefined}
          >
            SUBMISSIONS
          </a>
        </div>
      </nav>
    </header>
  )
}

export default PublicSiteNav