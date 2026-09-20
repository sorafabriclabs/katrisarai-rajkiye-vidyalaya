import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { NAV, SITE, SiteLink, UI } from '../content/site.content';
import { Language, Translator } from '../i18n/language';

/**
 * The top of every page: the university bar with the language switch, the
 * masthead, and the navigation.
 *
 * All three are one component rather than three because they are one piece of
 * furniture — the mobile menu drops out of the navigation and over the page,
 * the masthead and the bar share the brand, and splitting them would mean
 * passing the open state between siblings for no gain.
 */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  templateUrl: './site-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  private readonly router = inject(Router);
  private readonly translator = inject(Translator);

  protected readonly site = SITE;
  protected readonly ui = UI;
  protected readonly navigation = NAV;
  protected readonly t = this.translator.t;
  protected readonly language = this.translator.language;

  /** The mobile menu. Irrelevant above 760px, where the links are always shown. */
  protected readonly menuOpen = signal(false);

  /** The current path, with any fragment and query stripped. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => currentPath(this.router)),
    ),
    { initialValue: currentPath(this.router) },
  );

  constructor() {
    // A navigation with the menu open leaves it covering the page it just
    // moved to. Closing on the link's own click would miss a back button.
    effect(() => {
      this.path();
      this.menuOpen.set(false);
    });
  }

  /** Whether a link names the page being shown, for `aria-current`. */
  protected isCurrentPage(link: SiteLink): boolean {
    return link.path === this.path();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected use(language: Language): void {
    this.translator.use(language);
  }
}

function currentPath(router: Router): string {
  return router.url.split(/[?#]/)[0] || '/';
}
