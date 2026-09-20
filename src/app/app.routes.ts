import { Routes } from '@angular/router';

import { Text, text } from './i18n/language';

/**
 * What a route declares about itself, in its `data`.
 *
 * # Why the title is here and not in `Route.title`
 *
 * Angular's `title` is a `string`, and every title on this site is two strings.
 * A `TitleStrategy` could resolve one of them, but it would have to re-run on
 * a language change — which is not a navigation — so the strategy would end up
 * subscribing to the language signal to re-title a route it had already
 * finished with. `Seo` already watches both; giving it the pair directly is
 * the same work in one place. See `shared/seo.ts`.
 */
export interface PageMeta {
  readonly title: Text;
  readonly description: Text;
}

/** Spelled out so a route's `data` is checked rather than merely indexed. */
function page(meta: PageMeta): { page: PageMeta } {
  return { page: meta };
}

/**
 * A page that is drawn on its own, without the site's masthead and footer.
 *
 * Declared on the route rather than decided in the shell: `App` asks whether
 * the active route wants chrome, so adding another internal page later is a
 * line here and nothing else. A shell that special-cased `/admin` by path
 * would need editing every time, and would be the only place in the
 * application that knows an admin area exists.
 */
function standalone(): { standalone: true } {
  return { standalone: true };
}

/**
 * The site: five pages and a page for everything else.
 *
 * Each route carries its title and description in `data`; `Seo` reads both and
 * writes the head in whichever language is being read. Keeping them here
 * rather than in the components means the whole of what a search result or a
 * shared link looks like is one file.
 *
 * Every page is loaded lazily, including the landing page. The shell — header,
 * footer — is what the first chunk carries, and a visitor arriving at
 * `/contact` should not also download the hero photograph they are never going
 * to see.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
    data: page({
      title: text(
        'राजकीय डिग्री महाविद्यालय, कतरीसराय | नालन्दा',
        'Government Degree College, Katrisarai | Nalanda',
      ),
      description: text(
        'राजकीय डिग्री महाविद्यालय, कतरीसराय, नालन्दा: पाटलिपुत्र विश्वविद्यालय के अंतर्गत ' +
          'कला स्नातक विषय, शिक्षक एवं विद्यार्थी संसाधन।',
        'Discover Government Degree College, Katrisarai, Nalanda: undergraduate ' +
          'arts, departments, faculty and student resources under Patliputra University.',
      ),
    }),
  },
  {
    path: 'notices',
    loadComponent: () => import('./pages/notices/notices').then((m) => m.Notices),
    data: page({
      title: text(
        'सूचना पट्ट — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Notices — Government Degree College, Katrisarai',
      ),
      description: text(
        'परीक्षा, प्रवेश और महाविद्यालय से जुड़ी नवीनतम सूचनाएँ एवं घोषणाएँ।',
        'The latest examination, admission and college announcements from ' +
          'Government Degree College, Katrisarai, Nalanda.',
      ),
    }),
  },
  {
    path: 'academics',
    loadComponent: () => import('./pages/academics/academics').then((m) => m.Academics),
    data: page({
      title: text(
        'शैक्षणिक विषय — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Academics — Government Degree College, Katrisarai',
      ),
      description: text(
        'कला संकाय के अंतर्गत छह विषयों — हिंदी, अंग्रेजी, इतिहास, राजनीति विज्ञान, ' +
          'समाजशास्त्र और अर्थशास्त्र — में स्नातक स्तर की पढ़ाई।',
        'Undergraduate study in six arts subjects — Hindi, English, History, ' +
          'Political Science, Sociology and Economics — at Katrisarai, Nalanda.',
      ),
    }),
  },
  {
    path: 'faculty',
    loadComponent: () => import('./pages/faculty/faculty').then((m) => m.Faculty),
    data: page({
      title: text(
        'शिक्षक — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Faculty — Government Degree College, Katrisarai',
      ),
      description: text(
        'प्रभारी प्राचार्य प्रो. रामकृष्ण परमहंस तथा छह विभागों में कार्यरत 11 सहायक ' +
          'प्राध्यापकों (संविदा) का विभागवार विवरण।',
        'Principal in charge Prof. Ram Krishna Paramhans, and the 11 assistant ' +
          'professors teaching across the college’s six departments.',
      ),
    }),
  },
  {
    path: 'students',
    loadComponent: () => import('./pages/students/students').then((m) => m.Students),
    data: page({
      title: text(
        'विद्यार्थी संसाधन — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Student resources — Government Degree College, Katrisarai',
      ),
      description: text(
        'प्रवेश, पंजीकरण और परीक्षा के लिए पाटलिपुत्र विश्वविद्यालय के आधिकारिक पोर्टल ' +
          'तथा विद्यार्थियों के लिए उपयोगी सूचनाएँ।',
        'Patliputra University’s official portals for admission, registration ' +
          'and examination, and what a student at Katrisarai needs to know.',
      ),
    }),
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
    data: page({
      title: text(
        'संपर्क एवं परिसर — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Contact & campus — Government Degree College, Katrisarai',
      ),
      description: text(
        'महाविद्यालय का पता, प्राचार्य का संपर्क सूत्र तथा टेकनारायण +2 उच्च विद्यालय ' +
          'परिसर में उपलब्ध आधारभूत सुविधाएँ।',
        'Where the college is, how to reach the principal, and the campus it ' +
          'shares with Teknarayan +2 High School in Katrisarai, Nalanda.',
      ),
    }),
  },
  {
    /*
     * The admin area.
     *
     * Not protected by anything in this application, and deliberately so:
     * Cloudflare Access sits in front of the deployment, and the Worker
     * verifies a signed assertion on every write (`edge/access.ts`). A guard
     * here would be a second, weaker gate that could disagree with the first.
     *
     * It is excluded from `sitemap.xml` and disallowed in `robots.txt`, and
     * `app.routes.server.ts` keeps it out of the edge cache — a cached admin
     * page would be one administrator's view served to the next.
     */
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    data: {
      ...standalone(),
      ...page({
        title: text(
          'प्रबंधन — राजकीय डिग्री महाविद्यालय, कतरीसराय',
          'Admin — Government Degree College, Katrisarai',
        ),
        description: text(
          'महाविद्यालय की वेबसाइट पर सूचनाएँ प्रकाशित करने का प्रबंधन पृष्ठ।',
          'Internal page for publishing notices to the Government Degree College, Katrisarai website.',
        ),
      }),
    },
  },
  {
    /*
     * A page rather than a redirect to the landing page.
     *
     * Redirecting would answer 200 for every address anyone ever mistypes or
     * links to, which tells a crawler that an infinite number of URLs are the
     * home page and tells the edge cache to keep a copy of each. The matching
     * entry in `app.routes.server.ts` sets the status to 404, so this is a
     * genuine not-found with something readable on it.
     */
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
    data: page({
      title: text(
        'पृष्ठ नहीं मिला — राजकीय डिग्री महाविद्यालय, कतरीसराय',
        'Page not found — Government Degree College, Katrisarai',
      ),
      description: text(
        'यह पृष्ठ इस वेबसाइट पर उपलब्ध नहीं है।',
        'That page does not exist on this website.',
      ),
    }),
  },
];
