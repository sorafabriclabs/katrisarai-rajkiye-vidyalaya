import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ACADEMICS, STREAMS, SUBJECTS, Subject } from '../../content/academics.content';
import { SITE } from '../../content/site.content';
import { Translator } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';
import { Reveal } from '../../shared/reveal';

/**
 * The six subjects, as a grid of cards.
 *
 * The page ends by sending every procedural question to the university, which
 * is the one thing it exists to get right — see `ACADEMICS.foot`.
 */
@Component({
  selector: 'app-academics',
  imports: [PageHero, Reveal],
  templateUrl: './academics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Academics {
  protected readonly academics = ACADEMICS;
  protected readonly subjects = SUBJECTS;
  protected readonly site = SITE;
  protected readonly t = inject(Translator).t;

  /** `01 / LANGUAGES`, the line above each card's name. */
  protected label(subject: Subject, index: number): string {
    return `${String(index + 1).padStart(2, '0')} / ${this.t(STREAMS[subject.stream])}`;
  }
}
