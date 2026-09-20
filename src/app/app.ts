import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { UI } from './content/site.content';
import { Translator } from './i18n/language';
import { SiteFooter } from './layout/site-footer';
import { SiteHeader } from './layout/site-header';

/**
 * The shell every page is drawn inside: the university bar, the masthead and
 * its navigation, the page, the footer.
 *
 * Almost every page. A route may declare `standalone: true` in its data and
 * get none of it — the admin area does, because it is a tool for whoever
 * maintains the site rather than part of what a visitor reads, and wrapping it
 * in the college's masthead makes an internal form look like a public page.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);

  protected readonly t = inject(Translator).t;
  protected readonly ui = UI;

  /**
   * Whether the active route wants the site's chrome.
   *
   * Read from the route rather than from the URL, so the shell never learns
   * any particular path. The initial value matters: it is read synchronously
   * so the server's very first render is already correct, rather than drawing
   * a masthead and removing it after the first navigation resolves.
   */
  private readonly standalone = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => isStandalone(this.router)),
    ),
    { initialValue: isStandalone(this.router) },
  );

  protected readonly chrome = computed(() => !this.standalone());
}

function isStandalone(router: Router): boolean {
  let route: ActivatedRouteSnapshot = router.routerState.snapshot.root;
  while (route.firstChild) route = route.firstChild;
  return route.data['standalone'] === true;
}
