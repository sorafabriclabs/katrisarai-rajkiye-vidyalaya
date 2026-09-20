import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { UI } from './content/site.content';
import { Translator } from './i18n/language';
import { SiteFooter } from './layout/site-footer';
import { SiteHeader } from './layout/site-header';

/**
 * The shell every page is drawn inside: the university bar, the masthead and
 * its navigation, the page, the footer. Nothing here changes between routes,
 * which is what lets the pages themselves be lazily loaded without the site
 * appearing to rebuild itself on each navigation.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly t = inject(Translator).t;
  protected readonly ui = UI;
}
