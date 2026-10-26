/**
 * Public-route language contract (AOS-061).
 * No local storage, login state, or network request required.
 * Never imply the authenticated application is fully translated.
 */
export type PublicLanguage = 'es' | 'en'

const PUBLIC_ROUTES = ['/guide', '/demo', '/status'] as const
export type PublicRoute = typeof PUBLIC_ROUTES[number]

export function parsePublicLanguage(search: string): PublicLanguage {
  return new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'es'
}

export function publicRoute(path: PublicRoute, language: PublicLanguage): string {
  if (!PUBLIC_ROUTES.includes(path)) throw Error('UNSUPPORTED_PUBLIC_ROUTE')
  return language === 'en' ? path + '?lang=en' : path
}

export function updatePublicLanguage(language: PublicLanguage): void {
  const url = new URL(window.location.href)
  if (language === 'en') url.searchParams.set('lang', 'en')
  else url.searchParams.delete('lang')
  window.history.replaceState(window.history.state, '', url)
}
