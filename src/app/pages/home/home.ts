import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ABOUT, FACTS, HERO } from '../../content/home.content';
import { NOTICES } from '../../content/notices.content';
import { SITE } from '../../content/site.content';
import { Notice, isNew } from '../../../model/notice';
import { NoticeStore } from '../../notices/notice-store';
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
  private readonly store = inject(NoticeStore);

  protected readonly hero = HERO;
  protected readonly noticeCopy = NOTICES;
  protected readonly about = ABOUT;
  protected readonly facts = FACTS;
  protected readonly site = SITE;
  protected readonly t = inject(Translator).t;

  /**
   * The banner, which the office can replace from the admin area.
   *
   * The bundled photograph is the fallback rather than the default: it ships
   * with the build, so it is the one thing guaranteed to be there when D1 is
   * not.
   */
  protected readonly bannerSrc = computed(() => this.store.bannerUrl() ?? HERO.image.src);

  /** Whether the banner is still the bundled one, which is the only one we can describe. */
  protected readonly bannerIsDefault = computed(() => this.store.bannerUrl() === null);

  /** The three most recent notices, or none if the board is empty. */
  protected readonly latest = computed(() => this.store.notices().slice(0, 3));

  private readonly recent = computed(() => {
    const now = this.store.renderedAt();
    return new Set(
      this.store
        .notices()
        .filter((n) => isNew(n, now))
        .map((n) => n.id),
    );
  });

  protected isRecent(notice: Notice): boolean {
    return this.recent().has(notice.id);
  }
}
