import { requireClient } from './game'
import type { EditorialDossier } from './editorial'

/**
 * SOURCE-032: one-click editorial sourcing. This code NEVER publishes dossiers
 * or invents consequences. External RSS titles are citations to be verified.
 */
export const SOURCE_FEEDS = [
  { id: 'elpais-spain', category: 'Instituciones', hosts: ['elpais.com', 'www.elpais.com'] },
  { id: 'elpais-economy', category: 'Economía', hosts: ['elpais.com', 'www.elpais.com'] },
  { id: 'guardian-politics', category: 'Instituciones', hosts: ['www.theguardian.com'] },
  { id: 'guardian-world', category: 'Relaciones exteriores', hosts: ['www.theguardian.com'] },
  { id: 'bbc-politics', category: 'Instituciones', hosts: ['www.bbc.com', 'www.bbc.co.uk'] },
  { id: 'bbc-business', category: 'Economía', hosts: ['www.bbc.com', 'www.bbc.co.uk'] }
] as const

export type FeedId = (typeof SOURCE_FEEDS)[number]['id']
export interface VerifiedCitation {
  title: string
  url: string
  source: string
  publishedAt: string
  feedId: FeedId
}

export interface SourceDiscovery {
  articles: VerifiedCitation[]
  successfulFeeds: number
  unavailableFeeds: number
}

/** Fails closed on any unapproved host or URL injection. */
export function normalizeCitation(
  raw: unknown, feedId: FeedId, now = new Date()
): VerifiedCitation | null {
  const feed = SOURCE_FEEDS.find(f => f.id === feedId)
  if (!feed || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const a = raw as Record<string, unknown>
  if (typeof a.title !== 'string' || a.title.trim().length < 8 ||
    a.title.length > 300 || typeof a.source !== 'string' ||
    a.source.length < 4 || a.source.length > 100 ||
    typeof a.url !== 'string' || a.url.length > 2048 ||
    typeof a.publishedAt !== 'string') return null
  let link: URL
  try { link = new URL(a.url) } catch { return null }
  if (link.protocol !== 'https:' || link.username || link.password ||
    !feed.hosts.some(host => host === link.hostname) ||
    /[\r\n\t]/.test(a.url)) return null
  const published = Date.parse(a.publishedAt)
  const nowMs = now.getTime()
  if (!Number.isFinite(published) || published > nowMs ||
    published < nowMs - 14 * 86400000) return null
  return { title: a.title.trim(), url: link.href,
    source: a.source, publishedAt: new Date(published).toISOString(), feedId }
}

/** Calls the existing authenticated, role-checked Supabase Edge Function. */
export async function discoverWeeklySources(now = new Date()): Promise<SourceDiscovery> {
  const api = requireClient()
  const results = await Promise.allSettled(SOURCE_FEEDS.map(async feed => {
    const { data, error } = await api.functions.invoke(
      'news-discovery?feed=' + encodeURIComponent(feed.id), { method: 'GET' })
    if (error || !data || data.feed !== feed.id || !Array.isArray(data.articles) ||
      typeof data.fetchedAt !== 'string') throw new Error('SOURCE_UNAVAILABLE')
    return data.articles.slice(0, 30)
      .map((a: unknown) => normalizeCitation(a, feed.id, now))
      .filter((a: VerifiedCitation | null): a is VerifiedCitation => a !== null)
  }))
  const successfulFeeds = results.filter(r => r.status === 'fulfilled').length
  return {
    articles: results.flatMap(r => r.status === 'fulfilled' ? r.value : []),
    successfulFeeds, unavailableFeeds: SOURCE_FEEDS.length - successfulFeeds
  }
}

function citationIdentity(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const name of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(name)) parsed.searchParams.delete(name)
    }
    return parsed.href.replace(/\/$/, '')
  } catch { return url }
}

/** Preserves all touched slots. Does not infer policy facts from RSS metadata. */
export function prepareWeeklySources(
  draft: readonly EditorialDossier[], citations: readonly VerifiedCitation[]
): { draft: EditorialDossier[]; imported: number; remaining: number; distinctFeeds: number } {
  const seen = new Set(draft.filter(d => d.source_url)
    .map(d => citationIdentity(d.source_url)))
  const slots = draft.map((d,i) => ({ ...d, index: i })).filter(d =>
    !d.source_url && !d.title.trim() && !d.context.trim() &&
    !d.category.trim() &&
    d.options.every(o => !o.title.trim() && !o.description.trim()))
  const byFeed = new Map<FeedId, VerifiedCitation[]>()
  for (const feed of SOURCE_FEEDS) byFeed.set(feed.id, [])
  for (const citation of citations) {
    if (!byFeed.has(citation.feedId)) continue
    // Defense in depth against callers passing unvalidated data.
    if (!normalizeCitation(citation, citation.feedId)) continue
    byFeed.get(citation.feedId)!.push(citation)
  }
  for (const values of byFeed.values()) values.sort((a,b) =>
    b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url))
  const ordered: VerifiedCitation[] = []
  const sourceNames = new Set<FeedId>()
  // Round-robin forces geographic/section diversity rather than ten from one RSS.
  for (let round = 0; round < 3; round++) {
    for (const feed of SOURCE_FEEDS) {
      const values = byFeed.get(feed.id)!
      while (values.length) {
        const item = values.shift()!
        const key = citationIdentity(item.url)
        if (seen.has(key)) continue
        seen.add(key)
        ordered.push(item)
        sourceNames.add(item.feedId)
        break
      }
    }
  }
  const target = draft.map(d => ({ ...d }))
  let imported = 0
  for (const slot of slots) {
    const article = ordered[imported]
    if (!article) break
    target[slot.index] = {
      ...draft[slot.index],
      title: ('Debate institucional: ' + article.title).slice(0, 160),
      category: SOURCE_FEEDS.find(f => f.id === article.feedId)!.category,
      source_url: article.url, source_title: article.title,
      source_published_at: article.publishedAt
      // Context and choices intentionally remain incomplete pending fact check.
    }
    imported++
  }
  return {
    draft: target, imported, remaining: slots.length-imported,
    distinctFeeds: new Set(ordered.slice(0,imported).map(x=>x.feedId)).size
  }
}
