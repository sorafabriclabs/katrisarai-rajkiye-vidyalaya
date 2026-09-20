import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

import { ApiEnv, handleApi, isApiPath } from './edge/api';
import {
  EdgeCacheOptions,
  STATIC_ASSET_RE,
  edgeCacheKey,
  isShareableDocument,
  pinHtmlToOrigin,
  withCacheState,
  withEdgeTtl,
  worthCaching,
} from './edge/cache';
import { Bucket } from './edge/media';
import { Notice } from './model/notice';
import { BANNER_KEY, Database, contentStamp, getSetting, listNotices } from './edge/notices';

/**
 * The Cloudflare Pages entry point. `server.ts` is the Node equivalent and the
 * default; which one a build uses is `ssr.entry` in `angular.json`, so
 * `ng build` and `ng serve` are unaffected and `npm run build:cf` opts in.
 *
 * # This Worker runs first for every request
 *
 * Under Pages' `_worker.js` convention there is no asset layer in front of the
 * Worker — it is invoked for *everything*, including `.js` and `.css`, and has
 * to ask the `ASSETS` binding itself. That is the single biggest difference
 * from Workers Static Assets, where Cloudflare tries assets first and only
 * falls through on a miss. Forgetting it means every static file is answered by
 * a server render instead of by the CDN.
 *
 * # What it does, in order
 *
 *   1. static files, from the asset binding
 *   2. a cache lookup, keyed by URL *and deployment*
 *   3. the render, stored on the way out
 *   4. and, if the render throws, the client-rendered shell rather than a
 *      blank 500
 *
 * Every HTML response says which of those happened, in `X-Edge-Cache`:
 *
 *   curl -sI https://rdmkatrisarai.ac.in/ | grep -i x-edge-cache
 *
 * `HIT` means the edge answered without rendering, `MISS` means it rendered
 * and kept the result, and `BYPASS` means it rendered something it will not
 * keep. A page that never reports `HIT` on a second request is the symptom to
 * chase; see `EdgeCacheState`.
 *
 * # It still exports `reqHandler`
 *
 * The build's route extractor loads this file and looks for exactly that name,
 * checking for the marker `createRequestHandler` attaches.
 */

/** Variables and bindings available to the Worker. */
export interface Env {
  /** Cloudflare's static asset layer, holding the browser build. */
  readonly ASSETS: { fetch(request: Request): Promise<Response> };

  /**
   * Hostnames this deployment answers on, comma separated. Angular refuses a
   * request whose Host it does not recognise, and the build bakes in only what
   * `security.allowedHosts` names, so a hostname added later — a new preview
   * domain, a vanity domain — has to be named here or every request to it is
   * refused.
   */
  readonly ALLOWED_HOSTS?: string;

  /** The notice board. See `migrations/` for its schema. */
  readonly DB: Database;

  /** Uploaded files: the banner photograph and notice attachments. */
  readonly MEDIA: Bucket;

  /** Cloudflare Access, which is what makes the admin area an admin area. */
  readonly ACCESS_TEAM_DOMAIN?: string;
  readonly ACCESS_AUD?: string;

  /**
   * The commit a Pages deployment was built from, set by Cloudflare itself on
   * projects built through the dashboard's git integration. Read only as a
   * second source of deployment identity; a deploy made by
   * `tools/cloudflare.deployment.mjs` carries `__build-id.txt` instead.
   */
  readonly CF_PAGES_COMMIT_SHA?: string;
}

/** What Cloudflare passes as the third argument to `fetch`. */
export interface ExecutionCtx {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * How long a rendered page may be shared at the edge.
 *
 * A day, with a week of stale-while-revalidate behind it — far longer than a
 * site with live content would dare, and safe here for one reason: the cache
 * key carries the deployment's id, so publishing new content *is* the
 * invalidation. Nothing on this site changes between deploys. There is no
 * notice board to go stale and no date to be wrong.
 *
 * This is the number to revisit if the college ever publishes notices from
 * something other than a deploy. Until then, a day is conservative.
 *
 * The practical effect is that each page is rendered roughly once per
 * deployment per Cloudflare location, and every other visitor is served from
 * the nearest city.
 */
const EDGE_CACHE: EdgeCacheOptions = {
  ttlSeconds: 86_400,
  staleSeconds: 604_800,
};

/**
 * Built once per isolate rather than at module scope, because `allowedHosts`
 * comes from `env` and `env` does not exist until the first request.
 */
let engine: AngularAppEngine | undefined;

function appEngine(env: Env): AngularAppEngine {
  engine ??= new AngularAppEngine({
    allowedHosts: (env.ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  });
  return engine;
}

/** The Workers cache. Absent under Node SSR and `ng serve`. */
interface EdgeCacheStore {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function edgeCacheStore(): EdgeCacheStore | undefined {
  return (globalThis as { caches?: { default?: EdgeCacheStore } }).caches?.default;
}

/**
 * The identity of the running deployment, read once per isolate — or `null`
 * when this deployment cannot say what it is.
 *
 * `tools/cloudflare.deployment.mjs` writes `__build-id.txt` beside the assets,
 * so it ships *with* the deployment: an old isolate cannot see the new value
 * and a new one cannot see the old. `CF_PAGES_COMMIT_SHA` is the second source,
 * for a Pages project built from the dashboard's git integration, which never
 * runs that script and would otherwise have no identity at all.
 *
 * **`null` disables the cache rather than falling back to a constant.** A
 * shared fallback key is the one input that could outlive a deploy, and the
 * failure it produces is the exact one this mechanism exists to prevent: markup
 * naming content-hashed chunks that no longer exist, on a page that paints and
 * then does nothing. Losing the cache costs speed for as long as nobody
 * notices; getting this wrong costs a working site.
 */
let buildIdPromise: Promise<string | null> | undefined;

function buildId(env: Env): Promise<string | null> {
  buildIdPromise ??= env.ASSETS.fetch(new Request('https://assets.invalid/__build-id.txt'))
    .then((response) => (response.ok ? response.text() : ''))
    .then((text) => text.trim() || env.CF_PAGES_COMMIT_SHA?.trim() || null)
    .catch(() => env.CF_PAGES_COMMIT_SHA?.trim() || null);
  return buildIdPromise;
}

/**
 * What the Angular render is given, beyond the request itself.
 *
 * Angular picks this up as `REQUEST_CONTEXT`, and `NoticeStore` reads it — so
 * the notice board arrives in the render already loaded, rather than the
 * application fetching `/api/notices` and the Worker issuing a request to
 * itself mid-render.
 *
 * # Why it is loaded for every page
 *
 * Because it is one indexed query against a table with a few dozen rows, and
 * because the alternative — loading it only for the pages that show notices —
 * means this function has to know which pages those are. It already has to be
 * right about the cache key; making it also the authority on which routes read
 * which data is how the two quietly drift apart. The edge cache means this
 * runs roughly once per page per deployment per location.
 *
 * # Why a failure is not an error
 *
 * A database that is briefly unavailable should cost the notice board, not the
 * whole site. The landing page, the subjects, the faculty list and the contact
 * details are all in the bundle and none of them need D1 — so a failed read
 * renders the site with an empty notice board, and logs.
 */
async function renderContext(env: Env): Promise<NoticeSnapshot> {
  const renderedAt = new Date().toISOString();
  try {
    const [notices, bannerUrl] = await Promise.all([
      listNotices(env.DB),
      getSetting(env.DB, BANNER_KEY),
    ]);
    return { notices, bannerUrl: bannerUrl || null, renderedAt };
  } catch (error) {
    console.error('Notice board unavailable for this render', {
      error: error instanceof Error ? error.message : error,
    });
    return { notices: [], bannerUrl: null, renderedAt };
  }
}

/** Kept in step with `app/notices/notice-store.ts`, which reads it. */
interface NoticeSnapshot {
  readonly notices: readonly Notice[];
  readonly bannerUrl: string | null;
  readonly renderedAt: string;
}

async function handle(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // ── 0. The API and uploaded files ──────────────────────────────────────
  //
  // Before the asset branch, and that order is load-bearing: `/media/<hash>
  // .png` ends in `.png`, so the static-asset rule below would answer 404 for
  // every uploaded image before this ever ran.
  //
  // Never cached at the edge. The public list is already behind the page
  // render's cache, and everything else here is a write or is per-person.
  if (isApiPath(pathname)) {
    const response = await handleApi(request, env as unknown as ApiEnv);
    if (response) return response;
  }

  // ── 1. Static files ────────────────────────────────────────────────────
  // Explicit, because under Pages nothing tried them before this Worker did.
  const asset = await env.ASSETS.fetch(request);

  // An asset-shaped path must resolve to a real file — never to a page.
  //
  // Without this, a request arriving in the window between a deploy going live
  // and its assets finishing upload reaches the renderer, whose catch-all
  // answers 200 text/html for *any* path. Cloudflare then caches that markup
  // against the script's URL and every later request for the real file gets
  // HTML instead, for the whole cache TTL and surviving redeploys.
  //
  // Checking only `status === 404` is not enough: Pages' asset layer answers an
  // unmatched path with the site's index.html and a **200** whenever one exists
  // at the root. This build has none — Angular emits `index.csr.html` — so the
  // status check alone would pass today and start failing silently the first
  // time a route is prerendered. An HTML answer to a request for a script is
  // the signal, whatever its status.
  //
  // `no-store` keeps a transient miss from being cached in the first place.
  if (STATIC_ASSET_RE.test(pathname)) {
    const servedHtml = (asset.headers.get('content-type') ?? '').includes('text/html');
    if (asset.status === 404 || servedHtml) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return asset;
  }

  if (asset.status !== 404) {
    return asset;
  }

  // ── 2. The edge cache ──────────────────────────────────────────────────
  // Before rendering, because the whole point is not to render. A hit costs a
  // cache lookup; a miss costs what every request would otherwise cost.
  //
  // The admin page is never shared. It is per-administrator by definition, and
  // a cached copy would be one person's view handed to the next.
  const cache = pathname === '/admin' ? undefined : edgeCacheStore();
  const shareable = cache && isShareableDocument(request);
  const id = shareable ? await buildId(env) : null;

  // The content stamp is what lets the office publish a notice without waiting
  // out the day-long TTL: a publish bumps it, every key stops matching, and
  // the next request re-renders. Memoised for fifteen seconds inside
  // `contentStamp`, so this is not a database read per request.
  const stamp = shareable && id ? await contentStamp(env.DB).catch(() => '0') : '0';
  const key = shareable && id ? edgeCacheKey(url, id, stamp) : undefined;

  if (cache && key) {
    const hit = await cache.match(key);
    if (hit) return withCacheState(pinHtmlToOrigin(hit), 'HIT');
  }

  // ── 3. The render ──────────────────────────────────────────────────────
  let rendered: Response | null;
  try {
    rendered = await appEngine(env).handle(request, await renderContext(env));
  } catch (error) {
    // A throwing render takes the whole Worker with it otherwise: Cloudflare
    // answers an uncaught exception with an empty 500 — no content type, no
    // body, nothing logged — which is a blank white page for the visitor and
    // invisible to whoever is on call.
    //
    // So: say what happened, where `wrangler tail` and the dashboard will show
    // it, and then still serve the site.
    console.error('SSR render failed', {
      url: url.toString(),
      error: error instanceof Error ? (error.stack ?? error.message) : error,
    });
    return clientRenderFallback(env, request);
  }

  if (!rendered) {
    return new Response('Not found', { status: 404 });
  }

  if (cache && key && worthCaching(rendered)) {
    const forEdge = withEdgeTtl(rendered, EDGE_CACHE);
    // Two bodies from one render: one to store, one to answer with. Writing
    // the cache must not delay the visitor, so it is handed to the runtime to
    // finish after the response has gone — and awaited when there is no
    // context to hand it to, rather than dropped on the floor.
    const write = cache.put(key, forEdge.clone()).catch(() => undefined);
    if (ctx) ctx.waitUntil(write);
    else await write;
    return withCacheState(pinHtmlToOrigin(forEdge), 'MISS');
  }

  return withCacheState(pinHtmlToOrigin(rendered), 'BYPASS');
}

/**
 * What a visitor gets when the server-side render throws: the site, booted in
 * their browser instead.
 *
 * `index.csr.html` is the shell Angular emits for client rendering, so this is
 * not a new way for the app to start — it is the ordinary one, reached a
 * moment later. The visitor loses the server-rendered first paint and nothing
 * else.
 *
 * It is **never** written to the edge cache. A shell is the right answer for
 * the one request whose render failed and the wrong answer for the next
 * thousand — caching it would hand every visitor, and every crawler, an empty
 * document for the life of the entry.
 *
 * The 500 stands if even the shell is missing, because at that point there is
 * genuinely nothing to serve.
 */
async function clientRenderFallback(env: Env, request: Request): Promise<Response> {
  const shell = await env.ASSETS.fetch(
    new Request(new URL('/index.csr.html', request.url).toString()),
  ).catch(() => undefined);

  if (!shell?.ok) {
    return new Response('This page is temporarily unavailable.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(shell.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      // Never stored anywhere, by anyone. The next request should get a real
      // render, not a second-hand shell.
      'Cache-Control': 'private, no-store, must-revalidate',
      'X-Edge-Cache': 'BYPASS',
    },
  });
}

export default {
  fetch(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
    return handle(request, env, ctx);
  },
};

/**
 * Used by the build's route extractor, and by `ng serve` if it is ever pointed
 * at this configuration. Never by Cloudflare, which calls `fetch` above.
 *
 * There is no `ASSETS` binding in those contexts, so this goes straight to
 * Angular. That is correct rather than a gap: the dev server serves its own
 * files.
 */
export const reqHandler = createRequestHandler(async (request: Request) => {
  const engineForBuild = new AngularAppEngine();
  return (await engineForBuild.handle(request)) ?? null;
});
