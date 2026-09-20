-- The notice board, and the one setting the admin area can change.
--
--   npx wrangler d1 migrations apply katrisarai-notices --local   (development)
--   npx wrangler d1 migrations apply katrisarai-notices --remote  (production)

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,

  -- The day the office posted it, as YYYY-MM-DD. A date and not a timestamp:
  -- a notice board posts on a day, and storing a moment would make the "new"
  -- mark expire partway through a day at a different hour for each reader.
  -- See `isNew` in src/model/notice.ts.
  posted_at TEXT NOT NULL,

  -- Hindi is required, English is not. The office writes in Hindi, and an
  -- English reader is better served by the Hindi notice than by a blank one —
  -- `noticeFromRow` falls back. This is the opposite of the rule in
  -- src/app/content/, where a developer writes both and a spec enforces it.
  title_hi TEXT NOT NULL,
  title_en TEXT,
  body_hi TEXT NOT NULL,
  body_en TEXT,

  -- An uploaded file, if any. Three columns rather than JSON so that a query
  -- can find notices with attachments, and so a half-written attachment is a
  -- constraint violation rather than a malformed blob.
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_size INTEGER,

  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- An attachment is all three columns or none of them.
  CHECK (
    (attachment_url IS NULL AND attachment_name IS NULL AND attachment_size IS NULL)
    OR (attachment_url IS NOT NULL AND attachment_name IS NOT NULL AND attachment_size IS NOT NULL)
  )
);

-- The one query the public site makes, in the order it wants them.
-- `id` is in the index because it is the tiebreak for two notices posted on
-- the same day, which is ordinary for a notice board.
CREATE INDEX IF NOT EXISTS notices_listing ON notices (pinned DESC, posted_at DESC, id);

-- Small key/value settings: the banner image, and the content stamp the edge
-- cache keys on.
--
-- A table rather than a second binding. KV would be the more obvious home for
-- two rows, but it is eventually consistent — a notice published in Patna
-- could take a minute to be visible in Delhi, and the stamp is precisely the
-- thing that must change the instant a write lands.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seeded so the Worker never has to handle a missing stamp on a cold database.
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES ('content_stamp', '1', '2026-01-01T00:00:00.000Z');
