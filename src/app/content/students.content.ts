import { Text, text } from '../i18n/language';
import { SITE } from './site.content';

/**
 * The student resources page: three links to Patliputra University, and
 * nothing this site pretends to do itself.
 *
 * Every service a student actually needs — applying, registering, downloading
 * an admit card, seeing a result — belongs to the university and is already
 * built. A college site that reproduced any of it would be reproducing a form
 * whose fields change every session, so this page's entire job is to name the
 * three portals correctly and send people to them.
 */

export interface ResourceLink {
  readonly kind: Text;
  readonly title: Text;
  readonly href: string;
}

export const RESOURCES: readonly ResourceLink[] = [
  {
    kind: text('प्रवेश', 'ADMISSIONS'),
    title: text('समर्थ प्रवेश पोर्टल', 'Samarth admission portal'),
    href: SITE.university.admissions,
  },
  {
    kind: text('शैक्षणिक सेवाएँ', 'ACADEMIC SERVICES'),
    title: text('पंजीकरण एवं परीक्षा', 'Registration & examination'),
    href: SITE.university.examinations,
  },
  {
    kind: text('विश्वविद्यालय की सूचनाएँ', 'UNIVERSITY UPDATES'),
    title: text('सूचनाएँ, समय-सारणी एवं संसाधन', 'Notices, schedules & resources'),
    href: SITE.university.home,
  },
];

export const STUDENTS = {
  eyebrow: text('आपका अगला कदम', 'YOUR NEXT STEP'),
  title: text('जानकारी पाएँ।', 'Stay informed.'),
  titleAccent: text('जुड़े रहें।', 'Stay connected.'),
  lead: text(
    'पाटलिपुत्र विश्वविद्यालय के आधिकारिक पोर्टल से सीधे प्रवेश संबंधी जानकारी और शैक्षणिक ' +
      'सेवाएँ प्राप्त करें।',
    'Access admission information and academic services directly through ' +
      'Patliputra University’s official portals.',
  ),
  /**
   * Said plainly, once, above the links. A student who has just been told to
   * "apply on the college website" needs to hear that there is no such thing
   * before they go looking for a form that does not exist.
   */
  note: text(
    'प्रवेश, पंजीकरण और परीक्षा से जुड़ी सभी प्रक्रियाएँ विश्वविद्यालय द्वारा संचालित होती हैं। ' +
      'इस वेबसाइट पर कोई आवेदन पत्र नहीं भरा जाता।',
    'Admission, registration and examination are all run by the university. ' +
      'No application is submitted on this website.',
  ),
} as const;

/**
 * The campus, and what a student can expect to find on it.
 *
 * The amenities are the four the college profile records — and the list stops
 * there. A library, a laboratory and a hostel are the things a prospective
 * student most wants to read about and exactly the things this site has no
 * basis for claiming.
 */
export const CAMPUS = {
  eyebrow: text('शिक्षा, घर के करीब', 'LEARNING, CLOSER TO HOME'),
  title: text('समुदाय से जुड़ा।', 'Part of the community.'),
  titleAccent: text('आगे बढ़ने का अवसर।', 'A place to grow.'),
  body: text(
    'महाविद्यालय एक शैक्षणिक परिसर में संचालित है, जहाँ टेकनारायण +2 उच्च विद्यालय सहित अन्य ' +
      'स्थानीय विद्यालय भी स्थित हैं। शांत ग्रामीण परिवेश, पेयजल, बिजली और खेल का मैदान ' +
      'विद्यार्थियों की दैनिक आवश्यकताओं को पूरा करते हैं।',
    'The college operates in an educational campus shared with local schools, ' +
      'including Teknarayan +2 High School. A peaceful rural setting, drinking ' +
      'water, electricity and a playground support everyday college life.',
  ),
  amenities: [
    text('पेयजल', 'Drinking water'),
    text('बिजली', 'Electricity'),
    text('खेल का मैदान', 'Playground'),
  ] as readonly Text[],
  /** The other institutions sharing the campus, which is what makes it one. */
  neighbours: {
    eyebrow: text('साझा परिसर', 'A SHARED CAMPUS'),
    items: [
      text('प्राथमिक विद्यालय', 'Primary school'),
      text('आंगनबाड़ी', 'Anganwadi centre'),
      text('आवासीय विद्यालय', 'Residential school'),
      text('टेकनारायण +2 उच्च विद्यालय', 'Teknarayan +2 High School'),
    ] as readonly Text[],
  },
} as const;

/** The contact panel, which is the same wherever it is drawn. */
export const CONTACT = {
  eyebrow: text('आएँ और जुड़ें', 'VISIT & CONNECT'),
  label: text(
    'प्राचार्य का संपर्क · विश्वविद्यालय निर्देशिका',
    'Principal’s contact · University directory',
  ),
  directoryLink: text('विश्वविद्यालय की सूची देखें', 'View university listing'),
} as const;
