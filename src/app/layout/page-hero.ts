import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { Text, Translator } from '../i18n/language';

/**
 * The band at the top of every page that is not the landing page.
 *
 * The landing page opens on a photograph; the other four open on this — the
 * same shape, without the image, so a visitor always lands on the page's name
 * and its one-sentence summary before anything else.
 *
 * The heading is split into a plain part and an accented one because that is
 * how every heading on this site is set: the second clause takes the gold. It
 * is two inputs rather than one string with markup in it, so nothing here ever
 * needs `innerHTML` and no content file can put markup on the page.
 */
@Component({
  selector: 'app-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero">
      <div class="container">
        <span class="eyebrow">{{ t(eyebrow()) }}</span>
        <h1>
          {{ t(title()) }}
          <em>{{ t(titleAccent()) }}</em>
        </h1>
        @if (lead(); as leadText) {
          <p class="page-hero-lead">{{ t(leadText) }}</p>
        }
      </div>
    </section>
  `,
})
export class PageHero {
  readonly eyebrow = input.required<Text>();
  readonly title = input.required<Text>();
  readonly titleAccent = input.required<Text>();
  /** Optional: the 404 has a heading and a paragraph of its own instead. */
  readonly lead = input<Text | null>(null);

  protected readonly t = inject(Translator).t;
}
