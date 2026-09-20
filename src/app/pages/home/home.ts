import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ABOUT, FACTS, HERO } from '../../content/home.content';
import { SITE } from '../../content/site.content';
import { Translator } from '../../i18n/language';
import { StudentDesk } from '../../layout/student-desk';
import { Reveal } from '../../shared/reveal';

/**
 * The landing page: the photograph, the three quick links, the welcome, and
 * the four figures.
 *
 * Everything it says is in `home.content.ts`; this is the arrangement. The
 * order is the argument the page makes — where you are, what you can do right
 * now, who we are, and what the college amounts to in four numbers.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Reveal, StudentDesk],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly hero = HERO;
  protected readonly about = ABOUT;
  protected readonly facts = FACTS;
  protected readonly site = SITE;
  protected readonly t = inject(Translator).t;
}
