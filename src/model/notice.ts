import { Text, textOrFallback } from './text';

/**
 * A notice, as the site understands it.
 *
 * Shared between the Worker, which reads them out of D1, and the application,
 * which draws them. No Angular and no Cloudflare in here — the shape both
 * sides agree on, and the two or three rules that belong to the notice itself
 * rather than to either end.
 */
export interface Notice {
  readonly id: string;
  /** The day the office posted it, as `YYYY-MM-DD`. See `postedAt` below. */
  readonly postedAt: string;
  readonly title: Text;
  readonly body: Text;
  readonly attachment: NoticeAttachment | null;
  /** Held at the top of the list regardless of date. */
  readonly pinned: boolean;
}

/** A file hung off a notice — in practice a PDF from the university. */
export interface NoticeAttachment {
  /** The path the Worker serves it from, e.g. `/media/ab12….pdf`. */
  readonly url: string;
  /** What to call it in the link. The uploader's filename, cleaned up. */
  readonly name: string;
  readonly sizeBytes: number;
}

/** The row shape D1 returns. Snake case, nullable English, integer boolean. */
export interface NoticeRow {
  readonly id: string;
  readonly posted_at: string;
  readonly title_hi: string;
  readonly title_en: string | null;
  readonly body_hi: string;
  readonly body_en: string | null;
  readonly attachment_url: string | null;
  readonly attachment_name: string | null;
  readonly attachment_size: number | null;
  readonly pinned: number;
}

/** Turns a D1 row into a `Notice`, applying the English-falls-back-to-Hindi rule. */
export function noticeFromRow(row: NoticeRow): Notice {
  return {
    id: row.id,
    postedAt: row.posted_at,
    title: textOrFallback(row.title_hi, row.title_en),
    body: textOrFallback(row.body_hi, row.body_en),
    attachment:
      row.attachment_url && row.attachment_name
        ? {
            url: row.attachment_url,
            name: row.attachment_name,
            sizeBytes: row.attachment_size ?? 0,
          }
        : null,
    pinned: row.pinned === 1,
  };
}

/** How long a notice wears the "new" mark. */
export const NEW_FOR_DAYS = 60;

const DAY_MS = 86_400_000;

/**
 * Whether a notice still counts as new.
 *
 * # Why `now` is a parameter
 *
 * So that this is a pure function of two values and can be tested at the
 * boundary rather than only in the middle. "Is it new?" read off the clock
 * inside is a function whose interesting cases — exactly 60 days, 61 days,
 * posted today, dated tomorrow — can only be reached by waiting.
 *
 * # Why the comparison is in whole days
 *
 * `postedAt` is a date, not a moment: the office posts on a day and does not
 * record a time. Parsed as UTC midnight and compared against a timestamp, a
 * notice posted 60 days ago would stop being new partway through its sixtieth
 * day, at whatever hour the visitor happens to read it — and, because the page
 * is edge-cached, two visitors in the same hour could disagree. Flooring both
 * sides to a day makes the answer change once, at midnight UTC, for everybody.
 *
 * A notice dated in the future is new: the office has post-dated it, and the
 * alternative is a notice that is neither new nor, yet, old.
 */
export function isNew(notice: Notice, now: Date): boolean {
  const posted = Date.parse(`${notice.postedAt}T00:00:00Z`);
  if (Number.isNaN(posted)) return false;

  const today = Math.floor(now.getTime() / DAY_MS);
  const postedDay = Math.floor(posted / DAY_MS);
  const age = today - postedDay;

  return age <= NEW_FOR_DAYS;
}

/**
 * The order notices are shown in: pinned first, then newest.
 *
 * D1 sorts this already — see `edge/notices.ts` — and it is repeated here
 * because the client re-sorts after an admin edit, and a list that reorders
 * itself differently depending on where it was sorted is the kind of bug
 * nobody reproduces.
 *
 * The id is the final tiebreak so that two notices posted on the same day, a
 * very ordinary thing for a notice board, have a stable order rather than
 * whatever the query planner felt like.
 */
export function byPinnedThenNewest(a: Notice, b: Notice): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.postedAt !== b.postedAt) return a.postedAt < b.postedAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
