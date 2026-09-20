import { Notice, NoticeRow, noticeFromRow } from '../model/notice';

/**
 * Everything this site does with D1.
 *
 * The queries are here and the HTTP is in `api.ts`, so that the shape of the
 * data and the shape of the request are separate problems. Nothing here knows
 * about `Request`, status codes or Cloudflare Access.
 */

/** The slice of D1's interface this file uses. */
export interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

/** What the admin area may set on a notice. */
export interface NoticeInput {
  readonly postedAt: string;
  readonly titleHi: string;
  readonly titleEn: string | null;
  readonly bodyHi: string;
  readonly bodyEn: string | null;
  readonly attachment: { url: string; name: string; sizeBytes: number } | null;
  readonly pinned: boolean;
}

const COLUMNS = `
  id, posted_at, title_hi, title_en, body_hi, body_en,
  attachment_url, attachment_name, attachment_size, pinned
`;

/**
 * Every notice, in the order the site shows them.
 *
 * No pagination. A college notice board accumulates a few dozen rows a year,
 * the whole table is a few kilobytes, and the page is edge-cached — paging
 * would be machinery in front of a query that is already one indexed scan.
 * `LIMIT` is there as a ceiling, not as a page size: it bounds the worst case
 * if this is still running in ten years and nobody ever deleted anything.
 */
export async function listNotices(db: Database, limit = 500): Promise<Notice[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM notices
       ORDER BY pinned DESC, posted_at DESC, id
       LIMIT ?`,
    )
    .bind(limit)
    .all<NoticeRow>();
  return results.map(noticeFromRow);
}

export async function getNotice(db: Database, id: string): Promise<Notice | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM notices WHERE id = ?`)
    .bind(id)
    .first<NoticeRow>();
  return row ? noticeFromRow(row) : null;
}

export async function insertNotice(
  db: Database,
  id: string,
  input: NoticeInput,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notices (
         id, posted_at, title_hi, title_en, body_hi, body_en,
         attachment_url, attachment_name, attachment_size, pinned,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.postedAt,
      input.titleHi,
      input.titleEn,
      input.bodyHi,
      input.bodyEn,
      input.attachment?.url ?? null,
      input.attachment?.name ?? null,
      input.attachment?.sizeBytes ?? null,
      input.pinned ? 1 : 0,
      now,
      now,
    )
    .run();
}

export async function updateNotice(
  db: Database,
  id: string,
  input: NoticeInput,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE notices SET
         posted_at = ?, title_hi = ?, title_en = ?, body_hi = ?, body_en = ?,
         attachment_url = ?, attachment_name = ?, attachment_size = ?,
         pinned = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.postedAt,
      input.titleHi,
      input.titleEn,
      input.bodyHi,
      input.bodyEn,
      input.attachment?.url ?? null,
      input.attachment?.name ?? null,
      input.attachment?.sizeBytes ?? null,
      input.pinned ? 1 : 0,
      now,
      id,
    )
    .run();
}

export async function deleteNotice(db: Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM notices WHERE id = ?`).bind(id).run();
}

// ── Settings ─────────────────────────────────────────────────────────────

export async function getSetting(db: Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(
  db: Database,
  key: string,
  value: string,
  now: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, now)
    .run();
}

/** The key holding the banner image's path, if the office has replaced it. */
export const BANNER_KEY = 'banner_url';

/** The key holding the stamp the edge cache keys on. See `contentStamp`. */
export const STAMP_KEY = 'content_stamp';

/**
 * The content stamp: a number that changes whenever anything publishable does.
 *
 * # What it is for
 *
 * The edge cache holds a rendered page for a day, keyed by the deployment id —
 * which is exactly right for content that only changes when the site is
 * deployed, and exactly wrong for a notice board. Without this, the office
 * publishes a notice and it appears up to twenty-four hours later, which
 * everyone involved correctly reads as the feature being broken.
 *
 * Adding the stamp to the cache key means a publish invalidates the edge by
 * *not matching* any key that exists. No purge API, no API token to rotate, no
 * window in which the purge has not run yet — the same trick the deployment id
 * already uses, applied to content instead of to code.
 *
 * # Why it is memoised
 *
 * It is needed to build the cache key, so it is read *before* the cache
 * lookup — on every request, including the ones the cache is about to answer
 * for free. A D1 read there would put a database round trip in front of every
 * page view and undo most of what the cache is for.
 *
 * Fifteen seconds is the compromise: at most one read per isolate per fifteen
 * seconds, and a published notice is live within fifteen seconds rather than
 * instantly. For a notice board that is indistinguishable from instant, and it
 * is three orders of magnitude better than a day.
 */
let stampCache: { value: string; readAt: number } | undefined;
const STAMP_TTL_MS = 15_000;

export async function contentStamp(db: Database): Promise<string> {
  const now = Date.now();
  if (stampCache && now - stampCache.readAt < STAMP_TTL_MS) return stampCache.value;

  // A failed read must not become a *new* stamp on every request — that would
  // make every response a cache miss for as long as D1 is unhappy, turning a
  // database blip into a full-rate render storm. Falling back to the last
  // known value, or to a constant, keeps the cache working.
  const value = await getSetting(db, STAMP_KEY).catch(() => stampCache?.value ?? '0');
  stampCache = { value: value ?? '0', readAt: now };
  return stampCache.value;
}

/** Called after any write that changes what a visitor would see. */
export async function bumpContentStamp(db: Database, now: string): Promise<void> {
  const next = String(Date.now());
  await setSetting(db, STAMP_KEY, next, now);
  stampCache = { value: next, readAt: Date.now() };
}

/** Test seam: forgets the memoised stamp. */
export function resetStampCache(): void {
  stampCache = undefined;
}
