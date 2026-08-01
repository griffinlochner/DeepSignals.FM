import PublicSocialIcon from './PublicSocialIcon'
import { PUBLIC_SOCIAL_LINKS } from './publicSocialData'
import './publicSocialLinks.css'

type PublicSocialLinksProps = {
  className?: string
  ariaLabel?: string
}

function PublicSocialLinks({ className = '', ariaLabel = 'social links' }: PublicSocialLinksProps) {
  const combinedClassName = ['public-social-links', className].filter(Boolean).join(' ')

  return (
    <div className={combinedClassName} aria-label={ariaLabel}>
      {PUBLIC_SOCIAL_LINKS.map((socialLink) => (
        <a
          key={socialLink.network}
          className={`public-social-links__link public-social-links__link--${socialLink.network}`}
          href={socialLink.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={socialLink.ariaLabel}
        >
          <PublicSocialIcon network={socialLink.network} />
        </a>
      ))}
    </div>
  )
}

export default PublicSocialLinks
