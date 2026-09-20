import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RESOURCES, STUDENTS } from '../../content/students.content';
import { Translator } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';
import { Reveal } from '../../shared/reveal';

/**
 * Three links to Patliputra University, and a sentence saying that is all
 * there is.
 *
 * The page could say a great deal more and every extra sentence would be a
 * sentence about a process this site does not run. See `students.content.ts`.
 */
@Component({
  selector: 'app-students',
  imports: [PageHero, Reveal],
  templateUrl: './students.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Students {
  protected readonly students = STUDENTS;
  protected readonly resources = RESOURCES;
  protected readonly t = inject(Translator).t;
}
