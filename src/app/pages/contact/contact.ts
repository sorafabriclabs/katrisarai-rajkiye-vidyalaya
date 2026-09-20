import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SITE } from '../../content/site.content';
import { CAMPUS, CONTACT } from '../../content/students.content';
import { Translator } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';
import { Reveal } from '../../shared/reveal';

/**
 * Where the college is, what is on the campus, and the one number to ring.
 *
 * # Why there is no enquiry form
 *
 * There is no backend behind this site — it is five pages of HTML on
 * Cloudflare's edge — so a form would have to post somewhere that does not
 * exist yet. More to the point, the college has one published contact, the
 * principal's mobile, and the people this page is for are already holding a
 * phone. A form would add a step and a way to be ignored.
 *
 * If enquiries ever need to arrive as text rather than as calls, the thing to
 * add is an address, not a form: `mailto:` costs no backend and no spam
 * filtering.
 */
@Component({
  selector: 'app-contact',
  imports: [PageHero, Reveal],
  templateUrl: './contact.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contact {
  protected readonly campus = CAMPUS;
  protected readonly contact = CONTACT;
  protected readonly site = SITE;
  protected readonly t = inject(Translator).t;
}
