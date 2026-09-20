import { Text, text } from '../i18n/language';

/**
 * Everything that is true of the whole site rather than of one page: who the
 * college is, how to reach it, and the link lists that appear in the header
 * and the footer of every page.
 *
 * It lives in one file because it is the part most often edited by someone who
 * is not editing components — a new section in the navigation, a changed phone
 * number — and because the header and the footer must not be able to disagree
 * about what the site contains.
 */

/**
 * A link the site draws.
 *
 * `path` is somewhere in this app and is routed; `href` is anywhere else — the
 * university's portals, a `tel:` — and is a plain anchor. Exactly one of the
 * two is set, and the templates branch on `href` because that is the one that
 * must not go through the router.
 */
export interface SiteLink {
  readonly label: Text;
  readonly path?: string;
  readonly href?: string;
  /** Set on links that leave the site, so the markup and the label can say so. */
  readonly external?: boolean;
}

export const SITE = {
  name: text('राजकीय डिग्री महाविद्यालय', 'Government Degree College'),
  /** The full name, as it appears on a letterhead. Used in the footer and in JSON-LD. */
  fullName: text(
    'राजकीय डिग्री महाविद्यालय, कतरीसराय, नालन्दा',
    'Government Degree College, Katrisarai, Nalanda',
  ),
  place: text('कतरीसराय, नालन्दा · बिहार', 'KATRISARAI, NALANDA · BIHAR'),
  motto: text('ज्ञान · अवसर · समुदाय', 'KNOWLEDGE · OPPORTUNITY · COMMUNITY'),
  promise: text('उच्च शिक्षा के नए अवसर।', 'Opening doors to higher education.'),
  affiliation: text(
    'पाटलिपुत्र विश्वविद्यालय, पटना की अंगीभूत इकाई',
    'A constituent unit of Patliputra University, Patna',
  ),
  /** The principal's number, which is the college's public contact. */
  phone: '+919835070738',
  phoneDisplay: '+91 98350 70738',
  address: {
    campus: text('टेकनारायण +2 उच्च विद्यालय परिसर', 'Teknarayan +2 High School campus'),
    locality: text('कतरीसराय, नालन्दा, बिहार, भारत', 'Katrisarai, Nalanda, Bihar, India'),
  },

  /**
   * The canonical origin, used to build absolute URLs for `og:` tags, the
   * canonical link, `sitemap.xml` and `robots.txt`.
   *
   * **This is a placeholder.** The college has no domain registered yet. When
   * one is, change it here and in the three places that cannot import it —
   * `public/robots.txt`, `public/sitemap.xml` and the `allowedHosts` list in
   * `angular.json` — and `sitemap.spec.ts` will fail until the sitemap agrees.
   *
   * Absolute because a crawler and a link preview need one; relative URLs in
   * those tags are either ignored or resolved against whatever host the page
   * happened to be fetched from — which, for a site that also answers on
   * `*.pages.dev`, is the preview deployment.
   */
  origin: 'https://gdckatrisarai.ac.in',

  /** Who the university is, and where its portals live. */
  university: {
    name: text('पाटलिपुत्र विश्वविद्यालय, पटना', 'Patliputra University, Patna'),
    home: 'https://ppup.ac.in/',
    admissions: 'https://ppupadm.samarth.edu.in/',
    examinations: 'https://ppuponline.in/',
    directory: 'https://ppup.ac.in/principals',
  },

  /** The year the college was inaugurated, and the copyright line's year. */
  established: 2026,
} as const;

/** The primary navigation, in the header of every page. */
export const NAV: readonly SiteLink[] = [
  { label: text('मुखपृष्ठ', 'Home'), path: '/' },
  { label: text('सूचना पट्ट', 'Notices'), path: '/notices' },
  { label: text('शैक्षणिक विषय', 'Academics'), path: '/academics' },
  { label: text('शिक्षक', 'Faculty'), path: '/faculty' },
  { label: text('विद्यार्थी संसाधन', 'Student resources'), path: '/students' },
  { label: text('संपर्क', 'Contact'), path: '/contact' },
];

/**
 * The strip under the hero on every page: the three things a visitor most
 * often arrived to do, none of which this site can do itself.
 *
 * All three are the university's, and all three open in a new tab. A student
 * halfway through an admission form who loses this site has lost nothing; one
 * who loses the form has lost the form.
 */
export const STUDENT_DESK = {
  label: text('विद्यार्थी सहायता', 'STUDENT DESK'),
  links: [
    {
      label: text('विश्वविद्यालय में प्रवेश', 'University admissions'),
      href: SITE.university.admissions,
      external: true,
    },
    {
      label: text('पंजीकरण एवं परीक्षाएँ', 'Registration & examinations'),
      href: SITE.university.examinations,
      external: true,
    },
    { label: text('उपयोगी संसाधन', 'Useful resources'), path: '/students' },
  ] as readonly SiteLink[],
} as const;

/** The footer's link columns, each under its own heading. */
export const FOOTER_COLUMNS: readonly {
  readonly title: Text;
  readonly links: readonly SiteLink[];
}[] = [
  {
    title: text('महाविद्यालय', 'The college'),
    links: [
      { label: text('महाविद्यालय परिचय', 'About the college'), path: '/' },
      { label: text('सूचना पट्ट', 'Notices'), path: '/notices' },
      { label: text('शैक्षणिक विषय', 'Academics'), path: '/academics' },
      { label: text('शिक्षक', 'Faculty'), path: '/faculty' },
    ],
  },
  {
    title: text('विद्यार्थियों के लिए', 'For students'),
    links: [
      { label: text('विद्यार्थी संसाधन', 'Student resources'), path: '/students' },
      {
        label: text('समर्थ प्रवेश पोर्टल', 'Samarth admission portal'),
        href: SITE.university.admissions,
        external: true,
      },
      {
        label: text('पंजीकरण एवं परीक्षा', 'Registration & examination'),
        href: SITE.university.examinations,
        external: true,
      },
    ],
  },
  {
    title: text('संपर्क', 'Contact'),
    links: [
      { label: text('संपर्क एवं परिसर', 'Contact & campus'), path: '/contact' },
      { label: text(SITE.phoneDisplay, SITE.phoneDisplay), href: `tel:${SITE.phone}` },
      {
        label: text('विश्वविद्यालय निर्देशिका', 'University directory'),
        href: SITE.university.directory,
        external: true,
      },
    ],
  },
];

/**
 * Where the site's facts came from, shown in the footer behind a disclosure.
 *
 * It is not boilerplate. Almost everything here — the six subjects, the eleven
 * teachers, the principal's name — is transcribed from one PDF supplied by the
 * college, and a visitor who finds a detail out of date needs to know what it
 * was taken from and which of it the university, not this site, is the
 * authority on.
 */
export const SOURCES = {
  summary: text('जानकारी एवं स्रोत', 'Information & sources'),
  body: text(
    'महाविद्यालय, विषय और शिक्षकों की जानकारी: उपलब्ध कराया गया महाविद्यालय परिचय। ' +
      'महाविद्यालय कोड और संपर्क: पाटलिपुत्र विश्वविद्यालय निर्देशिका। जानकारी सितंबर 2026 में ' +
      'संकलित। प्रवेश की तिथियाँ और पात्रता विश्वविद्यालय के आधिकारिक पोर्टल पर जाँचें।',
    'College, course and faculty details: supplied college profile. University ' +
      'college code and contact: Patliputra University directory. Information ' +
      'compiled September 2026. Admission dates and eligibility should be ' +
      'checked on the official university portal.',
  ),
  profile: text('महाविद्यालय परिचय (हिंदी पीडीएफ)', 'College profile (Hindi PDF)'),
  directory: text('विश्वविद्यालय निर्देशिका', 'University directory'),
  /**
   * The banner photograph is ancient Nalanda, not this campus, and the credit
   * says so in both languages. Saying it only in English would leave exactly
   * the readers most likely to recognise the ruins thinking they were looking
   * at the college.
   */
  photoCredit: {
    lead: text(
      'बैनर का चित्र: प्राचीन नालन्दा की क्षेत्रीय विरासत; यह महाविद्यालय परिसर का चित्र नहीं है। छायाकार:',
      'Banner photograph: ancient Nalanda, shown as regional heritage, not the college campus. Photo:',
    ),
    author: text('श्रीजिता कुंदन / विकिमीडिया कॉमन्स', 'Srijitakundan / Wikimedia Commons'),
    authorHref: 'https://commons.wikimedia.org/wiki/File:Ruins_of_Nalanda.jpg',
    licence: 'CC BY-SA 4.0',
    licenceHref: 'https://creativecommons.org/licenses/by-sa/4.0/',
    trail: text(
      '। आकार बदला गया है; चित्र को काटकर और रंग की परत के साथ प्रदर्शित किया गया है।',
      '. Resized; displayed with cropping and an overlay.',
    ),
  },
} as const;

/**
 * The handful of words the chrome says that belong to no page: the skip link,
 * the menu button, the back-to-top link.
 *
 * Here rather than inline in the templates for the same reason as everything
 * else in this file — and for one more: an object literal written in a
 * template is rebuilt on every change detection, so `{{ t({hi: …, en: …}) }}`
 * allocates a pair of strings each time the view is checked.
 */
export const UI = {
  skipToContent: text('मुख्य सामग्री पर जाएँ', 'Skip to content'),
  menu: text('मेन्यू', 'Menu'),
  backToTop: text('ऊपर जाएँ', 'Back to top'),
  universitySite: text('विश्वविद्यालय की वेबसाइट', 'University website'),
  admissionPortal: text('प्रवेश पोर्टल', 'Admission portal'),
  brandHome: text('महाविद्यालय का मुखपृष्ठ', 'College home'),
  mainNavigation: text('मुख्य नेविगेशन', 'Main navigation'),
  languageGroup: text('वेबसाइट की भाषा', 'Website language'),
} as const;
