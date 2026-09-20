import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { DEPARTMENTS, FACULTY, PRINCIPAL } from '../../content/faculty.content';
import { Translator } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';
import { Reveal } from '../../shared/reveal';

/**
 * The principal, and the six departments with their teachers.
 *
 * The departments are `<details>` rather than a table or six headings: on a
 * phone the whole list is otherwise a screen and a half of names a visitor is
 * scrolling past to reach the one department they came for. The first is open,
 * so the pattern is visible without a tap.
 */
@Component({
  selector: 'app-faculty',
  imports: [PageHero, Reveal],
  templateUrl: './faculty.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Faculty {
  protected readonly faculty = FACULTY;
  protected readonly principal = PRINCIPAL;
  protected readonly departments = DEPARTMENTS;
  protected readonly t = inject(Translator).t;
}
