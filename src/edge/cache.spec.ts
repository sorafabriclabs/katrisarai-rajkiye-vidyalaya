import { describe, expect, it } from 'vitest';

import {
  STATIC_ASSET_RE,
  edgeCacheKey,
  isShareableDocument,
  pinHtmlToOrigin,
  withCacheState,
  withEdgeTtl,
  worthCaching,
} from './cache';

const html = (status = 200, headers: Record<string, string> = {}) =>
  new Response('<!doctype html><p>hi</p>', {
    status,
    headers: { 'content-type': 'text/html;charset=UTF-8', ...headers },
  });

describe('edgeCacheKey', () => {
  const key = (url: string, build = 'b1') => new URL(edgeCacheKey(new URL(url), build).url);

  it('stamps the deployment, so a deploy invalidates everything it wrote', () => {
    expect(key('https://rdmkatrisarai.ac.in/', 'deploy-7').searchParams.get('__build')).toBe(
      'deploy-7',
    );
    // Two deployments of the same URL are two entries, which is the whole
    // mechanism: the new one looks up a key that was never written.
    expect(key('https://rdmkatrisarai.ac.in/', 'a').toString()).not.toBe(
      key('https://rdmkatrisarai.ac.in/', 'b').toString(),
    );
  });

  it('drops click identifiers, so every ad click is one cache entry', () => {
    const plain = key('https://rdmkatrisarai.ac.in/').toString();
    for (const click of [
      '?fbclid=AbC123',
      '?gclid=xyz',
      '?FBCLID=upper-case-too',
      '?msclkid=1&ttclid=2&igshid=3',
      '?utm_source=linkedin&utm_campaign=beta',
      '?fbclid=one&utm_medium=paid',
    ]) {
      expect(key(`https://rdmkatrisarai.ac.in/${click}`).toString(), click).toBe(plain);
    }
  });

  it('keeps anything the render would actually depend on', () => {
    expect(key('https://rdmkatrisarai.ac.in/?page=2').searchParams.get('page')).toBe('2');
    expect(key('https://rdmkatrisarai.ac.in/?page=2').toString()).not.toBe(
      key('https://rdmkatrisarai.ac.in/?page=3').toString(),
    );
  });

  it('sorts what it keeps, so one page is one entry however it was linked', () => {
    expect(key('https://rdmkatrisarai.ac.in/x?a=1&b=2').toString()).toBe(
      key('https://rdmkatrisarai.ac.in/x?b=2&a=1').toString(),
    );
  });

  it('distinguishes paths', () => {
    expect(key('https://rdmkatrisarai.ac.in/contact').toString()).not.toBe(
      key('https://rdmkatrisarai.ac.in/faculty').toString(),
    );
  });
});

describe('isShareableDocument', () => {
  it('shares every ordinary page view — there is nothing personal on this site', () => {
    for (const path of ['/', '/contact', '/faculty', '/anything']) {
      expect(isShareableDocument(new Request(`https://rdmkatrisarai.ac.in${path}`))).toBe(true);
    }
  });

  it('refuses anything that is not a GET', () => {
    expect(
      isShareableDocument(new Request('https://rdmkatrisarai.ac.in/contact', { method: 'POST' })),
    ).toBe(false);
  });

  it('refuses a request carrying credentials', () => {
    expect(
      isShareableDocument(
        new Request('https://rdmkatrisarai.ac.in/', {
          headers: { Authorization: 'Bearer x' },
        }),
      ),
    ).toBe(false);
  });
});

describe('STATIC_ASSET_RE', () => {
  it('recognises build artefacts and shipped files', () => {
    for (const path of [
      '/main-ABC123.js',
      '/styles-XYZ.css',
      '/chunk-1.mjs',
      '/assets/college-mark.png',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/site.webmanifest',
      '/icon-512.PNG',
    ]) {
      expect(STATIC_ASSET_RE.test(path), path).toBe(true);
    }
  });

  it('does not claim application routes', () => {
    for (const path of ['/', '/contact', '/faculty', '/some/deep/page']) {
      expect(STATIC_ASSET_RE.test(path)).toBe(false);
    }
  });
});

describe('cache-control headers', () => {
  it('lets the edge share a render while every browser revalidates', () => {
    const header = withEdgeTtl(html(), {
      ttlSeconds: 3600,
      staleSeconds: 60,
    }).headers.get('Cache-Control');

    expect(header).toContain('s-maxage=3600');
    expect(header).toContain('stale-while-revalidate=60');
    // The browser's half must stay conservative: the document names hashed
    // chunks that the next deploy deletes.
    expect(header).toContain('max-age=0');
    expect(header).toContain('must-revalidate');
  });

  it('pins HTML to the origin on the way out', () => {
    expect(pinHtmlToOrigin(html()).headers.get('Cache-Control')).toBe(
      'private, no-cache, must-revalidate',
    );
  });

  it('leaves anything that is not HTML alone', () => {
    const asset = new Response('body{}', {
      headers: { 'content-type': 'text/css', 'cache-control': 'public, max-age=31536000' },
    });
    expect(pinHtmlToOrigin(asset).headers.get('Cache-Control')).toBe('public, max-age=31536000');
  });

  it('reports how the document was produced', () => {
    expect(withCacheState(html(), 'HIT').headers.get('X-Edge-Cache')).toBe('HIT');
  });
});

describe('worthCaching', () => {
  it('keeps a complete HTML render', () => {
    expect(worthCaching(html())).toBe(true);
  });

  it('refuses the 404 page, which an unbounded number of URLs map to', () => {
    expect(worthCaching(html(404))).toBe(false);
  });

  it('refuses a redirect and an error', () => {
    expect(worthCaching(html(302))).toBe(false);
    expect(worthCaching(html(500))).toBe(false);
  });

  it('refuses anything carrying a cookie', () => {
    expect(worthCaching(html(200, { 'set-cookie': 'a=1' }))).toBe(false);
  });

  it('refuses a non-HTML response', () => {
    expect(
      worthCaching(new Response('{}', { headers: { 'content-type': 'application/json' } })),
    ).toBe(false);
  });
});

/**
 * The content stamp is the half of the cache key that lets the office publish
 * a notice without waiting out a day-long TTL. These are the properties that
 * make it work, and the one that makes it safe.
 */
describe('edgeCacheKey — content stamp', () => {
  // `.url`, not `.toString()`: a Request stringifies to "[object Request]",
  // which compares equal to every other Request and makes any assertion here
  // pass or fail for the wrong reason.
  const key = (url: string, build: string, stamp: string) =>
    edgeCacheKey(new URL(url), build, stamp).url;

  it('separates two content stamps, so publishing invalidates every page', () => {
    expect(key('https://rdmkatrisarai.ac.in/notices', 'b1', 's1')).not.toBe(
      key('https://rdmkatrisarai.ac.in/notices', 'b1', 's2'),
    );
  });

  it('keeps the deployment and the content stamp independent', () => {
    // A deploy must invalidate even if no notice changed, and a publish must
    // invalidate even though the deployment did not.
    const a = key('https://rdmkatrisarai.ac.in/', 'b1', 's1');
    expect(key('https://rdmkatrisarai.ac.in/', 'b2', 's1')).not.toBe(a);
    expect(key('https://rdmkatrisarai.ac.in/', 'b1', 's2')).not.toBe(a);
  });

  it('is stable for the same url, deployment and content', () => {
    expect(key('https://rdmkatrisarai.ac.in/notices', 'b1', 's1')).toBe(
      key('https://rdmkatrisarai.ac.in/notices', 'b1', 's1'),
    );
  });

  it('still drops click identifiers once a stamp is in play', () => {
    expect(key('https://rdmkatrisarai.ac.in/notices?fbclid=xyz', 'b1', 's1')).toBe(
      key('https://rdmkatrisarai.ac.in/notices', 'b1', 's1'),
    );
  });
});
