import { Notice } from '../model/notice';
import { AccessConfig, AccessIdentity, verifyAccess } from './access';
import { Bucket, isUploadError, serveMedia, storeUpload } from './media';
import {
  BANNER_KEY,
  Database,
  NoticeInput,
  bumpContentStamp,
  deleteNotice,
  getNotice,
  insertNotice,
  listNotices,
  setSetting,
  updateNotice,
} from './notices';

/**
 * The write side of the site: everything under `/api`, plus `/media`.
 *
 * # The shape of it
 *
 *   GET    /api/notices        public   the notice board
 *   POST   /api/notices        admin    publish
 *   PUT    /api/notices/:id    admin    edit
 *   DELETE /api/notices/:id    admin    withdraw
 *   POST   /api/media          admin    upload a file, get back its URL
 *   PUT    /api/banner         admin    set (or clear) the hero photograph
 *   GET    /api/session        admin    who am I, for the admin page's header
 *   GET    /media/:key         public   a stored file
 *
 * # One rule, in one place
 *
 * Every route that is not marked `public` goes through `requireAdmin`, and
 * every route that changes something calls `bumpContentStamp` before it
 * answers. Both are easy to forget per-endpoint and catastrophic to forget
 * once — the first leaves the notice board writable by the internet, the
 * second leaves a published notice invisible for a day. They are enforced by
 * the structure of `handleApi` rather than by remembering.
 */

export interface ApiEnv {
  readonly DB: Database;
  readonly MEDIA: Bucket;
  readonly ACCESS_TEAM_DOMAIN?: string;
  readonly ACCESS_AUD?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      // Nothing here may be cached: the public list is behind the edge cache
      // already via the page render, and the admin responses are per-person.
      'Cache-Control': 'private, no-store',
    },
  });

const problem = (status: number, message: string): Response => json({ error: message }, status);

/** A request that only reads. HEAD is a GET whose body is thrown away. */
const isRead = (request: Request): boolean => request.method === 'GET' || request.method === 'HEAD';

/**
 * Whether this path belongs to the API at all.
 *
 * Exported so the Worker can ask *before* its static-asset branch, which would
 * otherwise answer 404 for `/media/<hash>.png` — that path ends in `.png` and
 * looks exactly like a missing build artefact.
 */
export function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/media/');
}

export async function handleApi(request: Request, env: ApiEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  // ── Public ───────────────────────────────────────────────────────────
  if (path.startsWith('/media/')) {
    if (!isRead(request)) return problem(405, 'Method not allowed');
    return serveMedia(env.MEDIA, path.slice('/media/'.length));
  }

  // HEAD as well as GET. A HEAD that falls through to the admin check answers
  // 401 on a public endpoint, which is what every health check, link checker
  // and crawler sends first.
  if (path === '/api/notices' && isRead(request)) {
    return json({ notices: await listNotices(env.DB) });
  }

  if (!path.startsWith('/api/')) return null;

  // ── Everything below this line is an administrator ───────────────────
  const identity = await requireAdmin(request, env);
  if (identity instanceof Response) return identity;

  if (path === '/api/session' && request.method === 'GET') {
    return json({ email: identity.email });
  }

  if (path === '/api/media' && request.method === 'POST') {
    return uploadMedia(request, env);
  }

  if (path === '/api/banner' && request.method === 'PUT') {
    return setBanner(request, env);
  }

  if (path === '/api/notices' && request.method === 'POST') {
    return publish(request, env, null);
  }

  const match = /^\/api\/notices\/([A-Za-z0-9_-]{1,64})$/.exec(path);
  if (match) {
    const id = match[1];
    if (request.method === 'PUT') return publish(request, env, id);
    if (request.method === 'DELETE') return withdraw(env, id);
  }

  return problem(404, 'No such endpoint');
}

/**
 * Resolves the caller, or returns the response that refuses them.
 *
 * A misconfigured Access setup throws out of `verifyAccess` and becomes a 500
 * here rather than a 401. The difference matters at three in the morning: a
 * 401 says "log in again" and sends whoever is on call looking at the wrong
 * thing entirely.
 */
async function requireAdmin(request: Request, env: ApiEnv): Promise<AccessIdentity | Response> {
  const config: AccessConfig = {
    teamDomain: env.ACCESS_TEAM_DOMAIN ?? '',
    audience: env.ACCESS_AUD ?? '',
  };

  let identity: AccessIdentity | null;
  try {
    identity = await verifyAccess(request, config);
  } catch (error) {
    console.error('Access verification failed', {
      error: error instanceof Error ? error.message : error,
    });
    return problem(500, 'Sign-in is not configured correctly on this deployment.');
  }

  if (!identity) return problem(401, 'Sign in to continue.');
  return identity;
}

// ── Notices ────────────────────────────────────────────────────────────

/** `null` id means create; an id means replace. */
async function publish(request: Request, env: ApiEnv, id: string | null): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'Expected a JSON body.');
  }

  const parsed = parseNotice(body);
  if ('error' in parsed) return problem(422, parsed.error);

  const now = new Date().toISOString();

  if (id) {
    if (!(await getNotice(env.DB, id))) return problem(404, 'That notice no longer exists.');
    await updateNotice(env.DB, id, parsed.input, now);
  } else {
    await insertNotice(env.DB, newId(), parsed.input, now);
  }

  await bumpContentStamp(env.DB, now);
  return json({ notices: await listNotices(env.DB) });
}

async function withdraw(env: ApiEnv, id: string): Promise<Response> {
  const existing = await getNotice(env.DB, id);
  if (!existing) return problem(404, 'That notice no longer exists.');

  await deleteNotice(env.DB, id);

  // The attachment is deliberately left in R2. Keys are content hashes, so the
  // same file may be attached to another notice, and a delete here would break
  // that one. Orphans cost a few kilobytes; a broken link on a live notice
  // costs someone their exam admit card.
  await bumpContentStamp(env.DB, new Date().toISOString());
  return json({ notices: await listNotices(env.DB) });
}

/**
 * Validates a posted notice.
 *
 * Returns the error rather than throwing, so that every failure is a 422 with
 * something the person typing can act on. "Invalid input" on a form with six
 * fields is a message that makes someone try each one in turn.
 */
export function parseNotice(body: unknown): { input: NoticeInput } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected an object.' };
  const raw = body as Record<string, unknown>;

  const titleHi = str(raw['titleHi']);
  const bodyHi = str(raw['bodyHi']);
  const postedAt = str(raw['postedAt']);

  if (!titleHi) return { error: 'A notice needs a title in Hindi (शीर्षक).' };
  if (titleHi.length > 300) return { error: 'The Hindi title is longer than 300 characters.' };
  if (!bodyHi) return { error: 'A notice needs a body in Hindi (विवरण).' };
  if (bodyHi.length > 8000) return { error: 'The Hindi body is longer than 8000 characters.' };

  // `YYYY-MM-DD`, and a real day. `2026-02-30` matches the pattern and is not
  // a date; left in, it would make `isNew` return false forever and the notice
  // would never wear the new mark.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) {
    return { error: 'The date must be written as YYYY-MM-DD.' };
  }
  const parsedDate = new Date(`${postedAt}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || !parsedDate.toISOString().startsWith(postedAt)) {
    return { error: `${postedAt} is not a real date.` };
  }

  const attachment = raw['attachment'];
  let parsedAttachment: NoticeInput['attachment'] = null;
  if (attachment !== null && attachment !== undefined) {
    if (typeof attachment !== 'object') return { error: 'The attachment is malformed.' };
    const a = attachment as Record<string, unknown>;
    const url = str(a['url']);
    const name = str(a['name']);
    const size = typeof a['sizeBytes'] === 'number' ? a['sizeBytes'] : NaN;
    // The URL must be one this site issued. Accepting an arbitrary one turns
    // the notice board into a way to put any link on the college's site under
    // the college's name.
    if (!/^\/media\/[0-9a-f]{32}\.(jpg|png|webp|pdf)$/.test(url)) {
      return { error: 'The attachment must be a file uploaded here.' };
    }
    if (!name) return { error: 'The attachment needs a name.' };
    if (!Number.isFinite(size) || size < 0) return { error: 'The attachment size is malformed.' };
    parsedAttachment = { url, name: name.slice(0, 200), sizeBytes: size };
  }

  return {
    input: {
      postedAt,
      titleHi,
      titleEn: str(raw['titleEn']) || null,
      bodyHi,
      bodyEn: str(raw['bodyEn']) || null,
      attachment: parsedAttachment,
      pinned: raw['pinned'] === true,
    },
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A notice's id: sortable by time, and unguessable enough that nobody can
 * enumerate drafts by counting upwards.
 */
function newId(): string {
  const stamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  return `${stamp}-${random}`;
}

// ── Media ──────────────────────────────────────────────────────────────

async function uploadMedia(request: Request, env: ApiEnv): Promise<Response> {
  const contentType = request.headers.get('Content-Type') ?? '';
  const name = request.headers.get('X-Upload-Name') ?? 'file';

  const bytes = await request.arrayBuffer();
  const stored = await storeUpload(env.MEDIA, bytes, contentType);

  if (isUploadError(stored)) {
    return problem(
      stored.reason === 'size' ? 413 : 415,
      stored.reason === 'size'
        ? `That file is ${stored.detail}. Please upload a smaller one.`
        : `That file type is not allowed (${stored.detail}). Use a JPG, PNG, WebP or PDF.`,
    );
  }

  return json({
    url: stored.url,
    name: decodeURIComponent(name).slice(0, 200),
    sizeBytes: stored.sizeBytes,
    contentType: stored.contentType,
  });
}

/** Sets the hero photograph, or clears it back to the one in the build. */
async function setBanner(request: Request, env: ApiEnv): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, 'Expected a JSON body.');
  }

  const url = str((body as Record<string, unknown>)?.['url']);
  if (url && !/^\/media\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(url)) {
    return problem(422, 'The banner must be an image uploaded here.');
  }

  const now = new Date().toISOString();
  await setSetting(env.DB, BANNER_KEY, url, now);
  await bumpContentStamp(env.DB, now);
  return json({ url: url || null });
}

/** Re-exported so the Worker can hand the same list to the Angular render. */
export type { Notice };
