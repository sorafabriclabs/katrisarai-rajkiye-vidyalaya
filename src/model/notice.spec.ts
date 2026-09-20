import { describe, expect, it } from 'vitest';

import { NEW_FOR_DAYS, Notice, byPinnedThenNewest, isNew, noticeFromRow } from './notice';

const notice = (over: Partial<Notice> = {}): Notice => ({
  id: 'n1',
  postedAt: '2026-09-20',
  title: { hi: 'सूचना', en: 'Notice' },
  body: { hi: 'विवरण', en: 'Details' },
  attachment: null,
  pinned: false,
  ...over,
});

/**
 * The 60-day rule decides whether a notice wears the "new" mark, which is the
 * only piece of behaviour on the notice board a visitor actually reads as a
 * claim. These are the boundaries.
 */
describe('isNew', () => {
  const now = new Date('2026-09-20T11:00:00Z');

  it('marks a notice posted today', () => {
    expect(isNew(notice({ postedAt: '2026-09-20' }), now)).toBe(true);
  });

  it('marks a notice on its sixtieth day, and not on its sixty-first', () => {
    // 2026-09-20 minus 60 days.
    expect(isNew(notice({ postedAt: '2026-07-22' }), now)).toBe(true);
    expect(isNew(notice({ postedAt: '2026-07-21' }), now)).toBe(false);
  });

  it('does not change answer with the hour, so two readers never disagree', () => {
    // The page is edge-cached: the same markup is served all day. If the
    // answer moved with the clock, the cached copy could contradict a fresh
    // render an hour later.
    const sixtiethDay = notice({ postedAt: '2026-07-22' });
    for (const hour of ['00:00:01', '06:30:00', '12:00:00', '23:59:59']) {
      expect(isNew(sixtiethDay, new Date(`2026-09-20T${hour}Z`)), hour).toBe(true);
    }
  });

  it('treats a post-dated notice as new rather than as neither', () => {
    expect(isNew(notice({ postedAt: '2026-12-01' }), now)).toBe(true);
  });

  it('is not fooled by a malformed date', () => {
    expect(isNew(notice({ postedAt: 'soon' }), now)).toBe(false);
    expect(isNew(notice({ postedAt: '' }), now)).toBe(false);
  });

  it('uses the constant the page prints, so the two cannot disagree', () => {
    expect(NEW_FOR_DAYS).toBe(60);
  });
});

describe('noticeFromRow', () => {
  const row = {
    id: 'n1',
    posted_at: '2026-09-20',
    title_hi: 'परीक्षा सूचना',
    title_en: 'Examination notice',
    body_hi: 'विवरण',
    body_en: 'Details',
    attachment_url: null,
    attachment_name: null,
    attachment_size: null,
    pinned: 0,
  };

  it('reads a complete row', () => {
    const n = noticeFromRow(row);
    expect(n.title).toEqual({ hi: 'परीक्षा सूचना', en: 'Examination notice' });
    expect(n.pinned).toBe(false);
    expect(n.attachment).toBeNull();
  });

  it('falls back to Hindi when English was not written', () => {
    // The office writes in Hindi. An English reader is better served by the
    // Hindi notice than by a blank one.
    const n = noticeFromRow({ ...row, title_en: null, body_en: '   ' });
    expect(n.title.en).toBe('परीक्षा सूचना');
    expect(n.body.en).toBe('विवरण');
  });

  it('reads the integer boolean', () => {
    expect(noticeFromRow({ ...row, pinned: 1 }).pinned).toBe(true);
  });

  it('only builds an attachment when it has both a url and a name', () => {
    expect(noticeFromRow({ ...row, attachment_url: '/media/a.pdf' }).attachment).toBeNull();
    expect(
      noticeFromRow({
        ...row,
        attachment_url: '/media/a.pdf',
        attachment_name: 'Result.pdf',
        attachment_size: 1024,
      }),
    ).toMatchObject({ attachment: { url: '/media/a.pdf', name: 'Result.pdf', sizeBytes: 1024 } });
  });
});

describe('byPinnedThenNewest', () => {
  it('puts pinned notices first whatever their date', () => {
    const old = notice({ id: 'a', postedAt: '2020-01-01', pinned: true });
    const recent = notice({ id: 'b', postedAt: '2026-09-20' });
    expect([recent, old].sort(byPinnedThenNewest).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('orders the rest newest first', () => {
    const list = [
      notice({ id: 'a', postedAt: '2026-01-01' }),
      notice({ id: 'b', postedAt: '2026-09-20' }),
      notice({ id: 'c', postedAt: '2026-05-05' }),
    ];
    expect(list.sort(byPinnedThenNewest).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks a same-day tie stably, because a notice board has those', () => {
    const a = notice({ id: 'a', postedAt: '2026-09-20' });
    const b = notice({ id: 'b', postedAt: '2026-09-20' });
    expect([b, a].sort(byPinnedThenNewest).map((n) => n.id)).toEqual(['a', 'b']);
    expect([a, b].sort(byPinnedThenNewest).map((n) => n.id)).toEqual(['a', 'b']);
  });
});
