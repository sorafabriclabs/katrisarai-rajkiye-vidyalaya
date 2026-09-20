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

  /** Every route that should be indexed: the real pages, not the catch-all. */
  const indexable = routes
    .filter((route) => route.path !== '**')
    .map((route) => `${SITE.origin}/${route.path}`);

  it('lists exactly the indexable routes', () => {
    expect([...listed].sort()).toEqual([...indexable].sort());
  });

  it('does not advertise the not-found page', () => {
    expect(listed.some((loc) => loc.includes('**'))).toBe(false);
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
  it('points at the sitemap on the canonical origin', () => {
    const robots = readFileSync('public/robots.txt', 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE.origin}/sitemap.xml`);
  });
});
