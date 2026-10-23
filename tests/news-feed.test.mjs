import assert from 'node:assert/strict'
import test from 'node:test'
import { FEEDS, parseRss } from '../supabase/functions/news-discovery/rss.mjs'

const now = new Date('2026-10-23T18:00:00Z')
const entry = (title, url, date = 'Fri, 23 Oct 2026 15:00:00 GMT') =>
  '<item><title>' + title + '</title><link>' + url + '</link><pubDate>' + date + '</pubDate></item>'
const rss = (...items) => '<?xml version="1.0"?><rss version="2.0"><channel>' + items.join('') + '</channel></rss>'

test('only catalogued, exact, HTTPS RSS sources can be queried', () => {
  assert.equal(Object.keys(FEEDS).length, 6)
  for (const feed of Object.values(FEEDS)) assert.ok(feed.url.startsWith('https://'))
  assert.deepEqual(parseRss(rss(entry('Current policy news', 'https://www.theguardian.com/politics/news')), 'fake-feed', now), [])
})
test('parses a credible citation with a stable UTC timestamp', () => {
  const result = parseRss(rss(entry('Parliament &amp; cabinet changes', 'https://www.theguardian.com/politics/reform')), 'guardian-politics', now)
  assert.deepEqual(result, [{ title: 'Parliament & cabinet changes',
    url: 'https://www.theguardian.com/politics/reform',
    source: 'The Guardian · UK politics', publishedAt: '2026-10-23T15:00:00.000Z' }])
})
test('deduplicates articles and rejects deceptive or non-HTTPS article URLs', () => {
  const allowed = 'https://www.theguardian.com/politics/reform'
  const result = parseRss(rss(
    entry('Current policy news', allowed), entry('Current policy news', allowed),
    entry('Malicious reference', 'https://www.theguardian.com.evil.example/story'),
    entry('Insecure reference', 'http://www.theguardian.com/story'),
    entry('Credentials reference', 'https://name:pw@www.theguardian.com/story'),
    entry('BBC reference', 'https://www.bbc.co.uk/news/politics')
  ), 'guardian-world', now)
  assert.equal(result.length, 1)
})
test('blocks stale, future and invalid publication dates', () => {
  const url = 'https://www.theguardian.com/politics/test'
  assert.deepEqual(parseRss(rss(entry('Old political event', url, 'Fri, 01 Oct 2021 15:00:00 GMT')), 'guardian-world', now), [])
  assert.deepEqual(parseRss(rss(entry('Future political event', url, 'Fri, 24 Oct 2026 15:00:00 GMT')), 'guardian-world', now), [])
  assert.deepEqual(parseRss(rss(entry('Unknown published date', url, 'not a date')), 'guardian-world', now), [])
})
test('rejects non-RSS, empty, oversize and markup-only headlines', () => {
  const valid = entry('Meaningful headline', 'https://www.theguardian.com/politics/test')
  assert.deepEqual(parseRss(valid, 'guardian-world', now), [])
  assert.deepEqual(parseRss(rss(valid) + 'x'.repeat(600001), 'guardian-world', now), [])
  assert.deepEqual(parseRss(rss(entry('<b></b>', 'https://www.theguardian.com/politics/test')), 'guardian-world', now), [])
})
test('handles CDATA headline entities without interpreting them as HTML', () => {
  const result = parseRss(rss(entry('<![CDATA[Cabinet <vote> & reforms]]>', 'https://www.theguardian.com/politics/reform')), 'guardian-world', now)
  assert.equal(result[0]?.title, 'Cabinet  & reforms')
})
