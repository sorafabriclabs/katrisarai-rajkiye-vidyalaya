/**
 * The rules the Worker applies around a render, with no Cloudflare and no
 * Angular in sight.
 *
 * Separated from `server.cloudflare.ts` for one reason: everything here is a
 * decision worth a test, and importing the Worker would pull in
 * `AngularAppEngine`, which needs a build manifest that only exists inside a
 * built bundle. The Worker is then the part that has no decisions left in it.
 */

/** How long the edge may hold a rendered document, and how long past that. */
export interface EdgeCacheOptions {
  /** Seconds the edge may serve a render without redoing it. */
  readonly ttlSeconds?: number;
  /**
   * Seconds beyond the TTL that a stale render may still be served while a
   * fresh one is produced behind it.
   */
  readonly staleSeconds?: number;
}

/**
 * Paths that can only ever be a build artefact or a static file, never a page.
 *
 * `robots.txt` and `sitemap.xml` are covered on purpose: they ship from
 * `public/` as real files rather than from a render.
 */
export const STATIC_ASSET_RE =
  /\.(?:js|mjs|cjs|css|map|json|txt|xml|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|wasm|webmanifest)$/i;

/**
 * Whether this request's document may be handed to the next visitor.
 *
 * Every page on this site is the same page for everyone — there is no login,
 * no student record and no form — so the honest answer is "yes, always". The
 * two refusals are still written down: a non-GET is not a document, and a
 * request carrying credentials is one where somebody has decided this URL is
 * about them. Neither happens here today. Both are cheap insurance against the
 * day a page stops being the same for everyone — a results portal, say — and
 * nobody remembers this file.
 */
export function isShareableDocument(request: Request): boolean {
  if (request.method !== 'GET') return false;
  if (request.headers.has('Authorization')) return false;
  return true;
}

/**
 * Query parameters that identify a *click* rather than a page.
 *
 * This list is what makes the cache work at all for shared links. An admission
 * notice passed around WhatsApp and Facebook arrives as
 * `?fbclid=<unique per click>`, so a key built from the raw URL is unique per
 * visitor: every share renders and the hit rate on exactly the traffic the
 * cache was meant to absorb — a few thousand people opening the same link on
 * the same afternoon — is zero.
 *
 * Dropping them from the key costs nothing. The key is internal to the cache
 * and never reaches the page, so the URL the visitor actually sees, and
 * anything reading `location.search`, is untouched.
 */
const CLICK_ID_PARAMS = new Set([
  'fbclid', // Meta
  'igshid', // Instagram
  'gclid', // Google Ads
  'gbraid',
  'wbraid',
  'dclid', // Display & Video 360
  'msclkid', // Microsoft
  'ttclid', // TikTok
  'twclid', // X
  'mc_cid', // Mailchimp
  'mc_eid',
  '_ga',
  '_gl',
]);

/**
 * The cache key: this URL, stamped with the deployment that would answer it.
 *
 * Stamping rather than purging is what makes a stale document impossible
 * instead of merely unlikely — a new deployment looks up keys that were never
 * written, so there is no purge call to remember, no API token to rotate, and
 * no window in which the purge has not run yet.
 *
 * Anything the render depends on stays in the key and is sorted, so `?a=1&b=2`
 * and `?b=2&a=1` are one entry. Click identifiers and `utm_*` tags do not
 * change a single byte of the output, so they go.
 */
export function edgeCacheKey(url: URL, buildId: string): Request {
  const keyUrl = new URL(url.toString());
  const kept = [...keyUrl.searchParams.entries()]
    .filter(
      ([name]) =>
        !CLICK_ID_PARAMS.has(name.toLowerCase()) && !name.toLowerCase().startsWith('utm_'),
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  keyUrl.search = '';
  for (const [name, value] of kept) keyUrl.searchParams.append(name, value);
  keyUrl.searchParams.set('__build', buildId);
  return new Request(keyUrl.toString(), { method: 'GET' });
}

/**
 * Whether a document came from the edge cache, from a render, or was never
 * eligible — reported on every HTML response as `X-Edge-Cache`.
 *
 * The whole mechanism is otherwise invisible: a hit and a miss are the same
 * bytes with the same headers, and the only outward sign of the cache working
 * is a latency difference that a cold edge and a warm one produce anyway. That
 * makes "is caching on?" a question nobody can answer from outside, which is
 * exactly when a cache quietly stops working and nobody notices for a month.
 *
 * `curl -sI https://gdckatrisarai.ac.in/ | grep -i x-edge-cache` is the whole
 * of the diagnostic. It leaks nothing: the values say how this deployment served a
 * public page, not who asked for it.
 */
export type EdgeCacheState =
  /** Served from Cloudflare's cache without rendering. */
  | 'HIT'
  /** Rendered, and stored for the next visitor. */
  | 'MISS'
  /**
   * Rendered and deliberately not stored — no cache in this runtime, no
   * deployment id to key on, a non-GET, or a response that is not a plain 200
   * HTML document (the 404 page, most often).
   */
  | 'BYPASS';

/** Stamps a response with how it was produced. */
export function withCacheState(response: Response, state: EdgeCacheState): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Edge-Cache', state);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Server-rendered HTML must be revalidated by the browser on every navigation.
 *
 * The document names content-hashed build artefacts that the next deploy
 * deletes. Angular ships no `Cache-Control` on these responses, so a browser
 * stores them heuristically and can replay yesterday's markup — which then
 * requests chunks that now correctly 404. Angular never bootstraps, so the page
 * paints from the server's markup and nothing on it is clickable.
 *
 * `no-cache` rather than `no-store`, because it still allows the back/forward
 * cache, which restores an already-running page instead of re-fetching the
 * document. Hashed assets keep their own long TTL; only the document is pinned.
 */
export function pinHtmlToOrigin(response: Response): Response {
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-cache, must-revalidate');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The rendered document, headed for the edge rather than for the browser.
 *
 * `s-maxage` addresses shared caches only, which is the whole point: Cloudflare
 * may hold this, while `max-age=0, must-revalidate` keeps every browser asking.
 * The pin applied on the way out is therefore preserved exactly — a visitor's
 * own cache stays as conservative as it ever was, and only the shared copy is
 * shared.
 */
export function withEdgeTtl(response: Response, options: EdgeCacheOptions): Response {
  const ttl = options.ttlSeconds ?? 60;
  const stale = options.staleSeconds ?? 600;
  const headers = new Headers(response.headers);
  headers.set(
    'Cache-Control',
    `public, max-age=0, must-revalidate, s-maxage=${ttl}, stale-while-revalidate=${stale}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Only a complete, successful HTML render is worth keeping.
 *
 * The status check is what keeps the 404 page out of the cache: it is rendered
 * by the catch-all route with `status: 404`, and an unbounded number of URLs
 * map to it.
 */
export function worthCaching(response: Response): boolean {
  return (
    response.status === 200 &&
    (response.headers.get('content-type') ?? '').includes('text/html') &&
    !response.headers.has('Set-Cookie')
  );
}
