import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import { FEEDS, parseRss } from './rss.mjs'

const ORIGINS = new Set([
  'https://act-of-state.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'GET, OPTIONS' } : {})
    }
  });
}

async function readBounded(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_FEED');
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 500000) throw new Error('FEED_TOO_LARGE');
      parts.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { joined.set(part, offset); offset += part.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(joined);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin') ?? '';
  if (origin && !ORIGINS.has(origin)) return json({ error: 'ORIGIN_FORBIDDEN' }, 403, origin);
  if (request.method === 'OPTIONS') return json({}, 200, origin);
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);

  const header = request.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(header))
    return json({ error: 'AUTH_REQUIRED' }, 401, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'SERVER_CONFIG' }, 503, origin);

  // Using the caller's JWT and existing RLS. No service-role key and no
  // browser-side staff claims. The server validates the actual Auth user.
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userResult, error: authError } = await db.auth.getUser();
  if (authError || !userResult.user)
    return json({ error: 'AUTH_REQUIRED' }, 401, origin);

  const { data: staff, error: staffError } = await db.from('editorial_members')
    .select('role').eq('user_id', userResult.user.id).maybeSingle();
  if (staffError) return json({ error: 'ROLE_CHECK_FAILED' }, 503, origin);
  if (staff?.role !== 'editor' && staff?.role !== 'publisher')
    return json({ error: 'EDITORIAL_FORBIDDEN' }, 403, origin);

  const feedId = new URL(request.url).searchParams.get('feed') ?? '';
  const feed = FEEDS[feedId as keyof typeof FEEDS];
  if (!feed) return json({ error: 'UNKNOWN_FEED' }, 400, origin);
  try {
    // Fixed trusted upstream endpoints: no arbitrary URL parameter, no
    // open proxy, and no redirect to an uncontrolled host.
    const response = await fetch(feed.url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      redirect: 'error',
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return json({ error: 'SOURCE_UNAVAILABLE' }, 502, origin);
    if (Number(response.headers.get('content-length')) > 500000)
      return json({ error: 'FEED_TOO_LARGE' }, 502, origin);
    const xml = await readBounded(response);
    const articles = parseRss(xml, feedId);
    return json({ feed: feedId, articles, fetchedAt: new Date().toISOString() }, 200, origin);
  } catch (error) {
    console.warn('Editorial RSS fetch failed:', error instanceof Error ? error.name : 'Unknown');
    return json({ error: 'SOURCE_UNAVAILABLE' }, 502, origin);
  }
});
