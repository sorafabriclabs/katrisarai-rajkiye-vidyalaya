import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { STUDENT_DESK } from '../content/site.content';
import { Translator } from '../i18n/language';

/**
 * The strip under the landing page's hero: the three things people arrive to
 * do, above the fold on a phone.
 *
 * It sits on the landing page only. Repeating it on `/students` would be
 * repeating that page's entire contents immediately above itself, and the
 * header's admission link already covers the other three pages.
 */
@Component({
  selector: 'app-student-desk',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="resource-strip">
      <div class="container">
        <span class="strip-label">{{ t(desk.label) }}</span>
        @for (link of desk.links; track link.label.en) {
          @if (link.href) {
            <a [href]="link.href" target="_blank" rel="noopener">
              <span>{{ t(link.label) }}</span>
              <span aria-hidden="true">↗</span>
            </a>
          } @else {
            <a [routerLink]="link.path">
              <span>{{ t(link.label) }}</span>
              <span aria-hidden="true">→</span>
            </a>
          }
        }
      </div>
    </div>
  `,
})
export class StudentDesk {
  protected readonly desk = STUDENT_DESK;
  protected readonly t = inject(Translator).t;
}
