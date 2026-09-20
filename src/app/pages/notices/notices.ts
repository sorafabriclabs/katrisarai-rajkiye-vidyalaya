import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { NOTICES } from '../../content/notices.content';
import { Translator } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';
import { NoticeStore } from '../../notices/notice-store';
import { Reveal } from '../../shared/reveal';
import { Notice, isNew } from '../../../model/notice';

/**
 * The notice board.
 *
 * The notices are already in memory by the time this renders — the Worker read
 * them before it started the render and passed them in. See `NoticeStore`.
 */
@Component({
  selector: 'app-notices',
  imports: [PageHero, Reveal],
  templateUrl: './notices.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notices {
  private readonly store = inject(NoticeStore);

  protected readonly copy = NOTICES;
  protected readonly t = inject(Translator).t;
  protected readonly notices = this.store.notices;

  /**
   * The "new" mark, decided once per render against the render's own clock.
   *
   * Reading `Date.now()` per notice in the template would make the answer
   * depend on when each row happened to be checked, and — worse — would part the
   * server's answer from the browser's on a device with a wrong clock, which
   * Angular reports as a hydration mismatch on a page that is not wrong.
   */
  protected readonly recent = computed(() => {
    const now = this.store.renderedAt();
    return new Set(
      this.notices()
        .filter((n) => isNew(n, now))
        .map((n) => n.id),
    );
  });

  protected isRecent(notice: Notice): boolean {
    return this.recent().has(notice.id);
  }

  /** `20 सितंबर 2026` / `20 September 2026`, from the stored `YYYY-MM-DD`. */
  protected formatDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(this.t({ hi: 'hi-IN', en: 'en-IN' }), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  /** `1.2 MB`, for the attachment link. */
  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
