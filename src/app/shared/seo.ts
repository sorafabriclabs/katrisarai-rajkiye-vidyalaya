import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { PageMeta } from '../app.routes';
import { SITE } from '../content/site.content';
import { Translator } from '../i18n/language';

/**
 * Title, description, canonical URL and link-preview tags, kept in step with
 * the route *and* with the language.
 *
 * # Why this exists rather than a tag in each template
 *
 * These tags belong to the document rather than to the page's markup, and the
 * page's markup is the only thing a component owns.
 *
 * # Why it must work on the server
 *
 * A crawler, a link unfurler and a preview card read the document as it
 * arrives; none of them run the application. Tags written after hydration
 * exist only for visitors who were never going to read them. So this starts
 * from an app initializer, which runs in both renders, and reacts to the one
 * navigation a server render performs before it serialises the page.
 *
 * # What a crawler actually sees
 *
 * Hindi. The server always renders `hi` — see `Translator` — so that is the
 * title and the description in the document, and it is what gets indexed. This
 * is the right default for the college and it is also a real limitation, worth
 * stating plainly: there is no `hreflang` pair here because there is no second
 * URL to point one at. Giving English its own URLs is the change to make if
 * that ever matters, and it is a change to the route table rather than to this
 * file.
 *
 * The canonical URL is built against `SITE.origin` rather than the request's
 * own host on purpose: this site will answer on its own domain, on
 * `*.pages.dev`, and on a per-deployment preview hostname, and only the first
 * of those should ever be indexed.
 */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly translator = inject(Translator);

  /**
   * The page being shown, as a signal rather than a field.
   *
   * The head depends on two things that change independently — which route is
   * active, and which language it is being read in — and a signal is what lets
   * one `effect` depend on both. Writing the tags from the navigation callback
   * instead would leave the title in the previous language until the next
   * navigation.
   */
  private readonly current = signal<PageMeta | null>(null);

  /** Subscribes for the life of the application; called once, at start-up. */
  start(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const route = deepest(this.router.routerState.snapshot.root);
      this.current.set((route.data['page'] as PageMeta | undefined) ?? null);
    });
  }

  constructor() {
    effect(() => {
      const meta = this.current();
      if (!meta) return;

      const t = this.translator.t;
      const title = t(meta.title);
      const description = t(meta.description);

      // The path without a fragment or a query. A fragment is a position on a
      // page rather than a different page, and the query strings this site
      // sees are campaign tags — neither is a separate URL to index. The root
      // keeps its trailing slash, because that is the form `sitemap.xml` lists
      // and the two disagreeing is the one way a canonical tag can do harm
      // rather than nothing.
      const path = this.router.url.split(/[?#]/)[0] || '/';
      const canonical = `${SITE.origin}${path}`;

      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });
      this.meta.updateTag({ property: 'og:url', content: canonical });
      this.meta.updateTag({
        property: 'og:locale',
        content: this.translator.language() === 'hi' ? 'hi_IN' : 'en_IN',
      });
      this.setCanonical(canonical);
    });
  }

  /**
   * There is one canonical link and it is moved rather than added to. Appending
   * a second would leave the page declaring two canonical URLs, which search
   * engines resolve by ignoring both.
   */
  private setCanonical(href: string): void {
    const existing = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (existing) {
      existing.href = href;
      return;
    }
    const link = this.document.createElement('link');
    link.rel = 'canonical';
    link.href = href;
    this.document.head.appendChild(link);
  }
}

/** The innermost activated route — the one that named the page. */
function deepest(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = route;
  while (current.firstChild) current = current.firstChild;
  return current;
}
