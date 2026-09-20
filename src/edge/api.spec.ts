import { describe, expect, it } from 'vitest';

import { isApiPath, parseNotice } from './api';

const good = {
  postedAt: '2026-09-20',
  titleHi: 'परीक्षा सूचना',
  bodyHi: 'विवरण यहाँ।',
};

/**
 * `parseNotice` is the only thing between the notice board and whatever is
 * posted to it. Every rule here exists because of what it lets through
 * otherwise, and the messages are part of the contract — a person is typing
 * into a form on the other end of them.
 */
describe('parseNotice', () => {
  const ok = (body: unknown) => {
    const result = parseNotice(body);
    if ('error' in result) throw new Error(`expected success, got: ${result.error}`);
    return result.input;
  };
  const err = (body: unknown) => {
    const result = parseNotice(body);
    if (!('error' in result)) throw new Error('expected an error');
    return result.error;
  };

  it('accepts a minimal Hindi-only notice', () => {
    const input = ok(good);
    expect(input.titleHi).toBe('परीक्षा सूचना');
    expect(input.titleEn).toBeNull();
    expect(input.pinned).toBe(false);
    expect(input.attachment).toBeNull();
  });

  it('requires Hindi, because that is what the office writes', () => {
    expect(err({ ...good, titleHi: '   ' })).toContain('title in Hindi');
    expect(err({ ...good, bodyHi: '' })).toContain('body in Hindi');
  });

  it('keeps English optional', () => {
    expect(ok({ ...good, titleEn: 'Examination notice' }).titleEn).toBe('Examination notice');
    expect(ok({ ...good, titleEn: '   ' }).titleEn).toBeNull();
  });

  it('rejects a date that matches the pattern but is not a day', () => {
    // The one that matters: 2026-02-30 passes a regex, and stored, it would
    // make `isNew` return false forever so the notice never wears the mark.
    expect(err({ ...good, postedAt: '2026-02-30' })).toContain('not a real date');
    expect(err({ ...good, postedAt: '2026-13-01' })).toContain('not a real date');
    expect(err({ ...good, postedAt: '20-09-2026' })).toContain('YYYY-MM-DD');
    expect(err({ ...good, postedAt: '' })).toContain('YYYY-MM-DD');
  });

  it('accepts a leap day in a leap year and refuses one otherwise', () => {
    expect(ok({ ...good, postedAt: '2028-02-29' }).postedAt).toBe('2028-02-29');
    expect(err({ ...good, postedAt: '2026-02-29' })).toContain('not a real date');
  });

  it('only accepts an attachment this site issued', () => {
    // Otherwise the notice board becomes a way to put any link on the
    // college's site, under the college's name.
    const attachment = { name: 'Result.pdf', sizeBytes: 100 };
    expect(
      err({ ...good, attachment: { ...attachment, url: 'https://example.com/evil.pdf' } }),
    ).toContain('uploaded here');
    expect(err({ ...good, attachment: { ...attachment, url: '/media/../secret' } })).toContain(
      'uploaded here',
    );
    expect(err({ ...good, attachment: { ...attachment, url: '/media/abc.pdf' } })).toContain(
      'uploaded here',
    );
    const url = `/media/${'a'.repeat(32)}.pdf`;
    expect(ok({ ...good, attachment: { ...attachment, url } }).attachment).toEqual({
      url,
      name: 'Result.pdf',
      sizeBytes: 100,
    });
  });

  it('caps the lengths, so one paste cannot fill the table', () => {
    expect(err({ ...good, titleHi: 'क'.repeat(301) })).toContain('300');
    expect(err({ ...good, bodyHi: 'क'.repeat(8001) })).toContain('8000');
  });

  it('treats pinned as a boolean and nothing else', () => {
    expect(ok({ ...good, pinned: true }).pinned).toBe(true);
    expect(ok({ ...good, pinned: 'yes' }).pinned).toBe(false);
    expect(ok({ ...good, pinned: 1 }).pinned).toBe(false);
  });

  it('refuses a body that is not an object', () => {
    expect(err(null)).toBeTruthy();
    expect(err('notice')).toBeTruthy();
    expect(err([])).toContain('title in Hindi');
  });
});

/**
 * The Worker asks this before its static-asset branch. If it ever stopped
 * matching `/media/`, every uploaded PNG would be answered with a 404 by the
 * asset layer — the path ends in `.png` and looks exactly like a missing build
 * artefact.
 */
describe('isApiPath', () => {
  it('claims the API and the media prefix', () => {
    expect(isApiPath('/api/notices')).toBe(true);
    expect(isApiPath('/media/abc.png')).toBe(true);
    expect(isApiPath('/media/abc.pdf')).toBe(true);
  });

  it('leaves the pages alone', () => {
    for (const path of ['/', '/notices', '/faculty', '/main-ABC123.js', '/favicon.ico']) {
      expect(isApiPath(path), path).toBe(false);
    }
  });

  it('does not claim a page that merely starts with the letters', () => {
    expect(isApiPath('/apitude')).toBe(false);
    expect(isApiPath('/mediation')).toBe(false);
  });
});

/**
 * HEAD is the method a health check, a link checker and most crawlers send
 * first. A public endpoint that answers 401 to it is a public endpoint that
 * every monitor reports as broken.
 */
describe('read methods', () => {
  it('treats HEAD as a read on the public endpoints', () => {
    // Guards the routing rule rather than the handler: `isApiPath` claims the
    // path, and the router must not then fall through to the admin check.
    for (const path of ['/api/notices', '/media/abc.png']) {
      expect(isApiPath(path), path).toBe(true);
    }
  });
});
