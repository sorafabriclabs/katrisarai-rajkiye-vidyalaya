import { RenderMode } from '@angular/ssr';
import { describe, expect, it } from 'vitest';

import { PageMeta, routes } from './app.routes';
import { serverRoutes } from './app.routes.server';

const meta = (route: (typeof routes)[number]) => route.data?.['page'] as PageMeta | undefined;

/**
 * The route table is the site's contents page: it decides what exists, what
 * each page is called in a search result, and how each is produced on the
 * server. These are the invariants that are easy to break by adding a page and
 * only half-wiring it.
 */
describe('routes', () => {
  it('gives every page a title and a description, in both languages', () => {
    for (const route of routes) {
      const page = meta(route);
      expect(page, `${route.path} has no page metadata`).toBeDefined();
      for (const language of ['hi', 'en'] as const) {
        expect(page!.title[language], `${route.path} title.${language}`).toBeTruthy();
        expect(
          page!.description[language].length,
          `${route.path} description.${language}`,
        ).toBeGreaterThan(20);
      }
    }
  });

  /**
   * The one check that catches a half-translation. A `Text` whose two sides
   * are identical is almost always a placeholder someone meant to come back
   * to — and the compiler cannot see it, because both fields are strings.
   */
  it('never leaves the two languages identical, which means one was not written', () => {
    for (const route of routes) {
      const page = meta(route)!;
      expect(page.title.hi, String(route.path)).not.toBe(page.title.en);
      expect(page.description.hi, String(route.path)).not.toBe(page.description.en);
    }
  });

  it('names the college in every title, so a tab is identifiable', () => {
    for (const route of routes) {
      expect(meta(route)!.title.hi, String(route.path)).toContain('कतरीसराय');
      expect(meta(route)!.title.en, String(route.path)).toContain('Katrisarai');
    }
  });

  it('loads every page lazily', () => {
    for (const route of routes) {
      expect(route.loadComponent, `${route.path} is not lazy`).toBeTypeOf('function');
    }
  });

  /**
   * `standalone` is what strips the masthead and footer off the admin area.
   * Lose it and an internal tool starts rendering as a public page of the
   * college's website, which looks like a design choice rather than a bug.
   */
  it('draws the admin area on its own, and every public page in the shell', () => {
    const standalone = routes
      .filter((route) => route.data?.['standalone'] === true)
      .map((route) => route.path);
    expect(standalone).toEqual(['admin']);
  });

  it('puts the catch-all last, or it would swallow the pages after it', () => {
    expect(routes.filter((r) => r.path === '**')).toHaveLength(1);
    expect(routes[routes.length - 1].path).toBe('**');
  });
});

describe('serverRoutes', () => {
  it('declares a render mode for every application route', () => {
    const declared = new Set(serverRoutes.map((r) => r.path));
    for (const route of routes) {
      expect(declared.has(route.path!), `${route.path} has no server route`).toBe(true);
    }
    // And nothing extra: a server route with no application route behind it is
    // either a page that was deleted or one that was never wired up.
    expect(serverRoutes).toHaveLength(routes.length);
  });

  it('server-renders every page, which is what the edge cache is in front of', () => {
    for (const route of serverRoutes) {
      expect(route.renderMode, String(route.path)).toBe(RenderMode.Server);
    }
  });

  it('answers an unknown address with a real 404', () => {
    const catchAll = serverRoutes.find((r) => r.path === '**');
    expect(catchAll).toBeDefined();
    expect((catchAll as { status?: number }).status).toBe(404);
  });

  it('gives the real pages no status override, so they stay 200', () => {
    for (const route of serverRoutes.filter((r) => r.path !== '**')) {
      expect((route as { status?: number }).status, String(route.path)).toBeUndefined();
    }
  });
});
