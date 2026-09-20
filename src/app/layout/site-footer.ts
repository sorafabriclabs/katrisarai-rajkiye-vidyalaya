import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FOOTER_COLUMNS, SITE, SOURCES, UI } from '../content/site.content';
import { Translator } from '../i18n/language';

/**
 * The foot of every page: the college's name, three columns of links, the
 * copyright line, and — behind a disclosure — where the facts on this site
 * came from.
 *
 * The sources are collapsed rather than omitted. Nobody reads them by choice;
 * the one person who does is checking whether a detail is current, and they
 * are the reason the disclosure exists at all.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly site = SITE;
  protected readonly ui = UI;
  protected readonly columns = FOOTER_COLUMNS;
  protected readonly sources = SOURCES;
  protected readonly t = inject(Translator).t;
}
