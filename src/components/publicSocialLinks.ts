export type PublicSocialNetwork = 'facebook' | 'instagram' | 'x'

export type PublicSocialLink = {
  network: PublicSocialNetwork
  href: string
  ariaLabel: string
}

export const PUBLIC_SOCIAL_LINKS: PublicSocialLink[] = [
  {
    network: 'facebook',
    href: 'https://www.facebook.com/people/DeepSignalsFM/61591116698277/#',
    ariaLabel: 'Visit DeepSignals.FM on Facebook',
  },
  {
    network: 'instagram',
    href: 'https://www.instagram.com/deepsignals.fm/',
    ariaLabel: 'Visit DeepSignals.FM on Instagram',
  },
  {
    network: 'x',
    href: 'https://x.com/DeepSignalsFM',
    ariaLabel: 'Visit DeepSignals.FM on X',
  },
]
