export function publicAssetUrl(pathname: string) {
  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = pathname.replace(/^\//, '')

  return `${normalizedBaseUrl}${normalizedPath}`
}