import { Text, text } from '../i18n/language';

/**
 * The six subjects taught at undergraduate level, and the page around them.
 *
 * This list and `faculty.content.ts` describe the same six departments from
 * two directions, which is why `key` exists on both: it is what lets the
 * faculty page's departments be checked against the subjects actually taught,
 * rather than the two drifting apart the first time a seventh subject opens.
 */

/** The identifier a subject and its department share. */
export type DepartmentKey =
  'hindi' | 'english' | 'history' | 'political-science' | 'sociology' | 'economics';

/** The faculty a subject sits in, shown above its name. */
export type Stream = 'languages' | 'humanities' | 'social-sciences';

export interface Subject {
  readonly key: DepartmentKey;
  readonly stream: Stream;
  readonly name: Text;
  /**
   * The name in Devanagari, shown under the English one.
   *
   * It is *not* a translation slot — on the Hindi reading of the page the
   * heading is already Devanagari and this line would repeat it, so the
   * stylesheet hides it under `html[lang='hi']`. It exists because a student
   * reading the English page is choosing between subjects they know by their
   * Hindi names.
   */
  readonly devanagari: string;
  readonly blurb: Text;
}

/** The stream labels, in the order the cards number themselves. */
export const STREAMS: Readonly<Record<Stream, Text>> = {
  languages: text('भाषाएँ', 'LANGUAGES'),
  humanities: text('मानविकी', 'HUMANITIES'),
  'social-sciences': text('सामाजिक विज्ञान', 'SOCIAL SCIENCES'),
};

export const SUBJECTS: readonly Subject[] = [
  {
    key: 'hindi',
    stream: 'languages',
    name: text('हिंदी', 'Hindi'),
    devanagari: 'हिंदी',
    blurb: text(
      'भाषा, साहित्य और सांस्कृतिक अभिव्यक्ति का अध्ययन करें।',
      'Explore language, literature and cultural expression.',
    ),
  },
  {
    key: 'english',
    stream: 'languages',
    name: text('अंग्रेजी', 'English'),
    devanagari: 'अंग्रेजी',
    blurb: text(
      'साहित्य, भाषा और नए दृष्टिकोणों से जुड़ें।',
      'Engage with literature, language and new perspectives.',
    ),
  },
  {
    key: 'history',
    stream: 'humanities',
    name: text('इतिहास', 'History'),
    devanagari: 'इतिहास',
    blurb: text(
      'अतीत और वर्तमान के बीच के संबंधों को समझें।',
      'Understand the past and its connections to our present.',
    ),
  },
  {
    key: 'political-science',
    stream: 'social-sciences',
    name: text('राजनीति विज्ञान', 'Political Science'),
    devanagari: 'राजनीति विज्ञान',
    blurb: text(
      'राजनीतिक विचारों, संस्थाओं और सार्वजनिक जीवन का अध्ययन करें।',
      'Examine political ideas, institutions and public life.',
    ),
  },
  {
    key: 'sociology',
    stream: 'social-sciences',
    name: text('समाजशास्त्र', 'Sociology'),
    devanagari: 'समाजशास्त्र',
    blurb: text(
      'समुदायों, संस्कृतियों और समाज की कार्यप्रणाली को समझें।',
      'Discover how communities, cultures and societies work.',
    ),
  },
  {
    key: 'economics',
    stream: 'social-sciences',
    name: text('अर्थशास्त्र', 'Economics'),
    devanagari: 'अर्थशास्त्र',
    blurb: text(
      'आर्थिक विकल्पों, संसाधनों और विकास का अध्ययन करें।',
      'Study economic choices, resources and development.',
    ),
  },
];

export const ACADEMICS = {
  eyebrow: text('अपना विषय चुनें', 'FIND YOUR FIELD'),
  title: text('विचार, जो खोलें', 'Ideas that open'),
  titleAccent: text('नई दिशाएँ।', 'new horizons.'),
  lead: [
    text(
      'छह विषय। जीवन भर सीखने की मजबूत नींव।',
      'Six subjects. A foundation for a lifetime of learning.',
    ),
    text('कला स्नातक (बी.ए.) · स्नातक स्तर', 'Bachelor of Arts · Undergraduate study'),
  ] as readonly Text[],
  /**
   * The disclaimer under the cards, and the point of the whole page.
   *
   * Eligibility, dates and the admission process are the university's, they
   * change every session, and a college site that answers them from memory is
   * a college site that tells a student the wrong closing date. So this page
   * describes the subjects and sends every procedural question to `ppup.ac.in`.
   */
  foot: text(
    'पात्रता, समय-सारणी और प्रवेश संबंधी सूचनाओं के लिए विश्वविद्यालय की वेबसाइट देखें।',
    'For eligibility, schedules and admission notices, refer to the university.',
  ),
  footLink: text('पाटलिपुत्र विश्वविद्यालय की वेबसाइट देखें', 'Visit Patliputra University'),
  /**
   * What the college expects to add, stated as a hope rather than a promise
   * because that is exactly how the college profile states it. A prospectus
   * that lists a subject nobody can yet enrol in is the one mistake this
   * section could make.
   */
  future: {
    eyebrow: text('भविष्य की संभावनाएँ', 'LOOKING AHEAD'),
    body: text(
      'आगामी शैक्षणिक सत्रों में विद्यार्थियों की आवश्यकताओं और माँग को ध्यान में रखते हुए कुछ ' +
        'अन्य विषयों की पढ़ाई प्रारंभ किए जाने की आशा है। नए विषयों की घोषणा विश्वविद्यालय के ' +
        'आधिकारिक पोर्टल पर की जाएगी।',
      'In coming academic sessions the college hopes to open further subjects, ' +
        'guided by what students need and ask for. Any new subject is ' +
        'announced on the university’s official portal.',
    ),
  },
} as const;
