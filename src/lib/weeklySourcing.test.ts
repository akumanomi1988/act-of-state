import { describe, it, expect, beforeEach, vi } from 'vitest'
import { newEditorialDossier, editorialReady } from './editorial'
import {
  SOURCE_FEEDS, normalizeCitation, discoverWeeklySources, prepareWeeklySources
} from './weeklySourcing'

const mock = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./game', () => ({ requireClient: () => ({
  functions: { invoke: mock.invoke }
}) }))

const today = new Date('2026-10-24T11:30:00Z')
const date = new Date().toISOString()
const hosts = [
  'elpais.com','elpais.com','www.theguardian.com','www.theguardian.com',
  'www.bbc.com','www.bbc.com'
]

function article(feed: number, i: number) {
  return {
    feedId: SOURCE_FEEDS[feed].id,
    title: 'Official article headline for sector ' + feed + ' number ' + i,
    url: 'https://' + hosts[feed] + '/national-policy/' + feed + '/' + i,
    source: 'Editorial news source ' + feed,
    publishedAt: date
  }
}

function blank() {
  return Array.from({ length: 10 }, (_, i) => newEditorialDossier('2026-10-26',i+1))
}

describe('AOS-032 editorial weekly citation pipeline',() => {
  beforeEach(() => { vi.clearAllMocks() })

  it('accepts only timely whitelisted HTTPS references',()=>{
    const a = article(0,1)
    expect(normalizeCitation(a,'elpais-spain')).not.toBeNull()
    expect(normalizeCitation({ ...a,url:'http://elpais.com/news'},'elpais-spain')).toBeNull()
    expect(normalizeCitation({ ...a,url:'https://elpais.com.evil.test/news'},'elpais-spain')).toBeNull()
    expect(normalizeCitation({ ...a,url:'https://www.theguardian.com/news'},'elpais-spain')).toBeNull()
    expect(normalizeCitation({ ...a,url:'https://alice:pwd@elpais.com/news'},'elpais-spain')).toBeNull()
    expect(normalizeCitation({ ...a,publishedAt:'2026-01-01T00:00:00Z'},'elpais-spain',today)).toBeNull()
    expect(normalizeCitation({ ...a,publishedAt:'2026-10-25T00:00:00Z'},'elpais-spain',today)).toBeNull()
    expect(normalizeCitation({ ...a,title:'bad'},'elpais-spain')).toBeNull()
  })

  it('prepares ten diverse sources and never fabricates decisions or policy consequences',()=>{
    const all = SOURCE_FEEDS.flatMap((_,f) =>
      Array.from({length:4}, (_,i)=>article(f,i)))
    const result=prepareWeeklySources(blank(),all)
    expect(result.imported).toBe(10)
    expect(result.remaining).toBe(0)
    expect(result.distinctFeeds).toBe(6)
    expect(new Set(result.draft.map(x=>x.source_url)).size).toBe(10)
    expect(result.draft.every(x =>
      x.source_url.startsWith('https://') &&
      x.title.startsWith('Debate institucional:') &&
      x.context === '' &&
      x.options.every(o=>o.title === '' && o.description === '') &&
      !editorialReady(x))).toBe(true)
  })

  it('never overwrites a previously authored or sourced dossier',()=>{
    const draft=blank()
    draft[0]={...draft[0],title:'A personally reviewed constitutional reform',
      category:'Institutional',context:'Original authored policy context'}
    draft[1]={...draft[1],source_url:'https://elpais.com/national-policy/0/0',
      source_title:'Existing source'}
    const initial=structuredClone(draft)
    const result=prepareWeeklySources(draft,SOURCE_FEEDS.flatMap((_,i)=>
      Array.from({length:3},(_,n)=>article(i,n))))
    expect(result.imported).toBe(8)
    expect(result.draft[0]).toEqual(initial[0])
    expect(result.draft[1]).toEqual(initial[1])
    expect(draft).toEqual(initial)
    expect(result.draft.slice(2).every(s=>s.source_url!=='')).toBe(true)
  })

  it('limits any one RSS to at most three headlines and deduplicates tracking variants',()=>{
    const citations=[
      ...Array.from({length:9},(_,i)=>article(0,i)),
      {...article(0,0),url:article(0,0).url+'?utm_source=weekly'},
      {...article(0,0),url:article(0,0).url+'#story'}
    ]
    const result=prepareWeeklySources(blank(),citations)
    expect(result.imported).toBe(3)
    expect(result.remaining).toBe(7)
    expect(new Set(result.draft.filter(x=>x.source_url).map(x=>x.source_url)).size).toBe(3)
  })

  it('tolerates an unavailable feed while respecting per-feed authorization',async()=>{
    mock.invoke.mockImplementation(async (path: string) => {
      const feed = new URL('https://example.invalid/'+path).searchParams.get('feed')
      if(feed==='bbc-politics') return {data:null,error:new Error('SOURCE_UNAVAILABLE')}
      const item = SOURCE_FEEDS.findIndex(x=>x.id===feed)
      return {data:{feed,articles:[article(item,1)],fetchedAt:date},error:null}
    })
    const result=await discoverWeeklySources()
    expect(mock.invoke).toHaveBeenCalledTimes(6)
    expect(result.successfulFeeds).toBe(5)
    expect(result.unavailableFeeds).toBe(1)
    expect(result.articles).toHaveLength(5)
    expect(result.articles.every(a=>SOURCE_FEEDS.some(x=>x.id===a.feedId))).toBe(true)
  })

  it('rejects an Edge Function response mismatched to the requested feed',async()=>{
    mock.invoke.mockResolvedValue({
      data:{feed:'forged-feed',articles:[article(0,0)],fetchedAt:date},error:null
    })
    const result=await discoverWeeklySources()
    expect(result.successfulFeeds).toBe(0)
    expect(result.articles).toHaveLength(0)
  })
})
