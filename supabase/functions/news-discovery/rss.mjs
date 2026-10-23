// Only extracts metadata from six explicitly approved, public RSS sources.
// Neither the feed content nor this parser can publish dossiers or policy outcomes.
export const FEEDS = Object.freeze({
  'elpais-spain': {
    label: 'EL PAÍS · España',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada',
    allowedHosts: ['elpais.com', 'www.elpais.com']
  },
  'elpais-economy': {
    label: 'EL PAÍS · Economía',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    allowedHosts: ['elpais.com', 'www.elpais.com']
  },
  'guardian-politics': {
    label: 'The Guardian · UK politics',
    url: 'https://www.theguardian.com/politics/rss',
    allowedHosts: ['www.theguardian.com']
  },
  'guardian-world': {
    label: 'The Guardian · World',
    url: 'https://www.theguardian.com/world/rss',
    allowedHosts: ['www.theguardian.com']
  },
  'bbc-politics': {
    label: 'BBC News · Politics',
    url: 'https://feeds.bbci.co.uk/news/politics/rss.xml',
    allowedHosts: ['www.bbc.com', 'www.bbc.co.uk']
  },
  'bbc-business': {
    label: 'BBC News · Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    allowedHosts: ['www.bbc.com', 'www.bbc.co.uk']
  }
});

function decodeXml(raw) {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (match, code) => {
      const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
      if (named[code.toLowerCase()]) return named[code.toLowerCase()];
      const numeric = code[1]?.toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return numeric > 0 && numeric <= 0x10ffff &&
        !(numeric >= 0xd800 && numeric <= 0xdfff)
        ? String.fromCodePoint(numeric) : match;
    }).trim();
}

function field(xml, name) {
  const result = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '\\s*>', 'i').exec(xml);
  return result ? decodeXml(result[1]) : '';
}

export function parseRss(xml, feedId, now = new Date()) {
  const feed = FEEDS[feedId];
  if (!feed || typeof xml !== 'string' || xml.length > 600000 ||
    !/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) return [];
  const articles = [];
  const seen = new Set();
  const nowMs = now.getTime();
  const oldest = nowMs - 14 * 86400000;
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)) {
    if (articles.length >= 30) break;
    const entry = match[0];
    const title = field(entry, 'title').slice(0, 300);
    const link = field(entry, 'link');
    const published = Date.parse(field(entry, 'pubDate'));
    if (title.length < 8 || title.length > 300 ||
      !Number.isFinite(published) || published < oldest || published > nowMs + 300000) continue;
    let url;
    try { url = new URL(link); } catch { continue; }
    if (url.protocol !== 'https:' || !feed.allowedHosts.includes(url.hostname) ||
      url.username || url.password || seen.has(url.href)) continue;
    seen.add(url.href);
    articles.push({
      title, url: url.href, source: feed.label,
      publishedAt: new Date(published).toISOString()
    });
  }
  return articles;
}
