import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { SITE } from './content/site.content';

/**
 * `public/sitemap.xml` is written by hand — there are five pages and a
 * generator would be more code than the file. This is what stops that being a
 * mistake: a page added to the routes and forgotten in the sitemap, or left in
 * the sitemap after being deleted, fails here rather than silently going
 * un-indexed or advertising a 404 to every crawler that reads it.
 *
 * It also catches the thing most likely to be forgotten when the college
 * finally has a domain — `SITE.origin` changed and the sitemap not.
 */
describe('sitemap.xml', () => {
  const xml = readFileSync('public/sitemap.xml', 'utf8');
  const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  /**
   * Every route that should be indexed: the public pages.
   *
   * `/admin` is excluded here as well as from the file. It is an internal page
   * behind Cloudflare Access — listing it would advertise it to every crawler
   * that reads the sitemap, and the spec would otherwise demand it be listed.
   */
  const NOT_INDEXED = new Set(['**', 'admin']);
  const indexable = routes
    .filter((route) => !NOT_INDEXED.has(String(route.path)))
    .map((route) => `${SITE.origin}/${route.path}`);

  it('lists exactly the indexable routes', () => {
    expect([...listed].sort()).toEqual([...indexable].sort());
  });

  it('does not advertise the not-found page', () => {
    expect(listed.some((loc) => loc.includes('**'))).toBe(false);
  });

  it('does not advertise the admin page', () => {
    expect(listed.some((loc) => loc.endsWith('/admin'))).toBe(false);
  });

  it('uses the canonical origin, which is what `Seo` writes on each page', () => {
    for (const loc of listed) {
      expect(loc.startsWith(`${SITE.origin}/`), loc).toBe(true);
    }
  });
});

/**
 * `robots.txt` names the sitemap by absolute URL, which is the one place the
 * origin appears that no import can reach.
 */
describe('robots.txt', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');

  it('points at the sitemap on the canonical origin', () => {
    expect(robots).toContain(`Sitemap: ${SITE.origin}/sitemap.xml`);
  });

  it('keeps crawlers out of the admin area and the API', () => {
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api/');
  });
});

/**
 * `src/index.html` carries the origin three times — `og:image`, and the `url`
 * and `logo` of the JSON-LD — and no import reaches any of them.
 *
 * That gap is why this exists. When the domain changed from gdckatrisarai to
 * rdmkatrisarai, the four places the README listed were all guarded or
 * obvious; these three were neither, and a stale `og:image` is invisible until
 * somebody shares a link and gets a broken preview, while a stale JSON-LD
 * `url` tells a search engine the college lives somewhere it does not.
 */
describe('index.html', () => {
  const html = readFileSync('src/index.html', 'utf8');
  const origins = [...html.matchAll(/https:\/\/[a-z0-9.-]*katrisarai[a-z0-9.-]*/gi)].map(
    (m) => m[0],
  );

  it('mentions the origin at all, so the check is not passing vacuously', () => {
    expect(origins.length).toBeGreaterThanOrEqual(3);
  });

  it('uses the canonical origin everywhere it names one', () => {
    for (const found of origins) {
      expect(found.startsWith(SITE.origin), `${found} should be ${SITE.origin}`).toBe(true);
    }
  });
});
