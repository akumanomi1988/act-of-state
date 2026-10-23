import { useState } from 'react'
import { requireClient } from './lib/game'

export interface NewsCandidate {
  title: string
  url: string
  source: string
  publishedAt: string
}

const feedOptions = [
  { id: 'elpais-spain', title: 'EL PAÍS · España' },
  { id: 'elpais-economy', title: 'EL PAÍS · Economía' },
  { id: 'guardian-politics', title: 'The Guardian · Política' },
  { id: 'guardian-world', title: 'The Guardian · Internacional' },
  { id: 'bbc-politics', title: 'BBC · Política' },
  { id: 'bbc-business', title: 'BBC · Economía' }
] as const

function isCandidate(raw: unknown): raw is NewsCandidate {
  if (!raw || typeof raw !== 'object') return false
  const item = raw as Record<string, unknown>
  if (typeof item.title !== 'string' || item.title.length < 8 ||
    item.title.length > 300 || typeof item.source !== 'string' ||
    typeof item.url !== 'string' || typeof item.publishedAt !== 'string') return false
  try {
    return new URL(item.url).protocol === 'https:' &&
      Number.isFinite(Date.parse(item.publishedAt)) &&
      Date.parse(item.publishedAt) <= Date.now() + 300000
  } catch { return false }
}

export default function NewsDiscoveryPanel({
  disabled, usedUrls, onPick
}: {
  disabled: boolean
  usedUrls: string[]
  onPick: (candidate: NewsCandidate) => void
}) {
  const [feed, setFeed] = useState<(typeof feedOptions)[number]['id']>('elpais-spain')
  const [articles, setArticles] = useState<NewsCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  async function discover() {
    if (loading || disabled) return
    setLoading(true)
    setError('')
    setArticles([])
    try {
      const { data, error: invokeError } = await requireClient().functions.invoke(
        'news-discovery?feed=' + encodeURIComponent(feed), { method: 'GET' })
      if (invokeError) throw invokeError
      if (!data || !Array.isArray(data.articles) ||
        typeof data.fetchedAt !== 'string') throw new Error('INVALID_NEWS_RESPONSE')
      setArticles(data.articles.filter(isCandidate).slice(0, 30))
      setFetchedAt(data.fetchedAt)
    } catch {
      setError('No se pudieron consultar las noticias. Comprueba la sesión editorial y vuelve a intentarlo.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="news-discovery" aria-label="Descubrir noticias reales">
    <p className="eyebrow">01 / FUENTES DE ACTUALIDAD</p>
    <h4>Explorar noticias publicadas</h4>
    <p className="muted">Importa únicamente la referencia documental. Debes comprobar
      la noticia, redactar el contexto político y definir las consecuencias antes de publicar.</p>
    <div className="news-discovery-controls">
      <label>Medio y sección
        <select value={feed} disabled={disabled || loading}
          onChange={event => { setFeed(event.target.value as typeof feed); setArticles([]); setFetchedAt(''); setError('') }}>
          {feedOptions.map(option => <option value={option.id} key={option.id}>{option.title}</option>)}
        </select>
      </label>
      <button type="button" disabled={disabled || loading} onClick={() => void discover()}>
        {loading ? 'Consultando…' : 'Consultar titulares'}
      </button>
    </div>
    {error && <p role="alert" className="editorial-alert">{error}</p>}
    {fetchedAt && <p className="muted">Consulta: {new Date(fetchedAt).toLocaleString('es-ES')}.
      Los titulares no equivalen a verificación editorial.</p>}
    {articles.length === 0 && fetchedAt && !loading && !error &&
      <p role="status">No hay artículos recientes válidos en este canal.</p>}
    {articles.length > 0 && <ul className="news-discovery-list">
      {articles.map(article => <li key={article.url}>
        <div><strong>{article.title}</strong><small>{article.source} ·
          {' '}{new Date(article.publishedAt).toLocaleString('es-ES')}</small>
          <a href={article.url} rel="noopener noreferrer" target="_blank">
            Leer la noticia original ↗
          </a>
        </div>
        <button type="button" disabled={disabled || usedUrls.includes(article.url)}
          onClick={() => onPick(article)}>
          {usedUrls.includes(article.url) ? 'Ya seleccionada' : 'Vincular fuente'}
        </button>
      </li>)}
    </ul>}
  </section>
}
