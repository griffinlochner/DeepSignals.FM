import type { PublicSocialNetwork } from './publicSocialLinks'

type PublicSocialIconProps = {
  network: PublicSocialNetwork
}

function PublicSocialIcon({ network }: PublicSocialIconProps) {
  if (network === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 20v-7h2.3l.3-2.7h-2.6V3.8c0-.8.2-1.3 1.3-1.3h1.4V.1c-.2 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H7.7V13h2.4v7h3.4Z" />
      </svg>
    )
  }

  if (network === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.3 3H21l-6.4 7.3L22 21h-5.6l-4.4-5.7L6.8 21H4l6.8-7.8L2 3h5.7l4 5.3L18.3 3Zm-1 16.2h1.1L7 4.7H5.8l11.5 14.5Z" />
    </svg>
  )
}

export default PublicSocialIcon
