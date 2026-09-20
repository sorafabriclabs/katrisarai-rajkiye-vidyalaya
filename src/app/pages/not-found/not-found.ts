import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Translator, text } from '../../i18n/language';
import { PageHero } from '../../layout/page-hero';

/**
 * The page for an address that is not one of ours.
 *
 * It is served with a 404 — see the catch-all in `app.routes.server.ts` — so a
 * crawler is told the truth and the edge cache, which keeps only 200s, does
 * not accumulate an entry per mistyped URL.
 */
@Component({
  selector: 'app-not-found',
  imports: [PageHero, RouterLink],
  templateUrl: './not-found.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {
  protected readonly t = inject(Translator).t;

  /**
   * The only copy on this site that is not in `content/`. It is six strings
   * nobody will ever ask to change, and a `not-found.content.ts` beside them
   * would be a file whose whole job is to be imported once.
   */
  protected readonly copy = {
    eyebrow: text('त्रुटि 404', 'ERROR 404'),
    title: text('यह पृष्ठ', 'That page isn’t'),
    titleAccent: text('उपलब्ध नहीं है।', 'here.'),
    lead: text(
      'आपके द्वारा खोला गया पता इस वेबसाइट पर मौजूद नहीं है। संभव है कि यह बदल गया हो, ' +
        'या लिंक टाइप करने में कोई चूक हुई हो।',
      'The address you followed does not exist on this website. It may have ' +
        'moved, or the link may have been mistyped.',
    ),
    heading: text('मुखपृष्ठ से शुरू करें', 'Start from the beginning'),
    body: text(
      'मुखपृष्ठ पर महाविद्यालय का परिचय, विषय, शिक्षक और विद्यार्थियों के लिए उपयोगी ' +
        'संसाधन उपलब्ध हैं।',
      'The home page covers the college, its subjects, its faculty and the ' +
        'resources a student needs.',
    ),
    action: text('मुखपृष्ठ पर जाएँ', 'Go to the home page'),
  } as const;
}
