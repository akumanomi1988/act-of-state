import { useSyncExternalStore } from 'react'

const query = '(max-width: 760px)'
function snapshot(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : window.innerWidth <= 760
}
function subscribe(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', notify)
    return () => mql.removeEventListener('change', notify)
  }
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

/** The same breakpoint as mobile-focus.css; no timers or account state. */
export function useMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
