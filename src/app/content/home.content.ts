import { Text, text } from '../i18n/language';

/**
 * The landing page, as data.
 *
 * The page is a sequence of sections whose copy changes far more often than
 * their layout, so the copy is here and only the layout is in the template.
 * The rule for what belongs in this file: anything the principal's office
 * would change without asking a developer.
 */

/**
 * The hero, over the photograph of Nalanda.
 *
 * The headline is three lines rather than one sentence because it is set at
 * 72px and has to break *somewhere*; breaking it here means it breaks at the
 * same place in both languages, on every width, instead of wherever the
 * measure happens to run out.
 */
export const HERO = {
  eyebrow: text('नालन्दा की विरासत। भविष्य की ओर।', 'ROOTED IN NALANDA. LOOKING AHEAD.'),
  lines: [
    text('एक नया अध्याय।', 'A new chapter.'),
    text('एक नई दुनिया,', 'A world of'),
  ] as readonly Text[],
  /** The last line, which takes the gold. */
  accent: text('संभावनाओं की।', 'possibilities.'),
  body: [
    text('उच्च शिक्षा, अब घर के करीब।', 'Bringing higher education closer to home.'),
    text('कतरीसराय में कला, मानविकी', 'Discover your path in the arts, humanities'),
    text('और सामाजिक विज्ञान में अपना भविष्य बनाएँ।', 'and social sciences at Katrisarai.'),
  ] as readonly Text[],
  primary: text('हमारे विषय जानें', 'Explore our programmes'),
  secondary: text('हमारा परिचय', 'Get to know us'),
  /**
   * The photograph, and what it is of. `alt` describes the ruins rather than
   * naming the college, because that is what is in the frame — the footer's
   * credit is where the distinction is spelled out.
   */
  image: {
    src: '/assets/heritage.jpg',
    alt: text(
      'प्राचीन नालन्दा के ऐतिहासिक खंडहर और हरा-भरा परिसर',
      'The historic brick ruins and green grounds of ancient Nalanda',
    ),
    caption: text('चित्र: नालन्दा की ऐतिहासिक विरासत', 'PICTURED: NALANDA’S HISTORIC HERITAGE'),
  },
} as const;

/** The welcome, and what the college is. */
export const ABOUT = {
  eyebrow: text('हमारे महाविद्यालय में आपका स्वागत है', 'WELCOME TO OUR COLLEGE'),
  title: text('स्थानीय जुड़ाव।', 'Local roots.'),
  titleAccent: text('भविष्य के अवसर।', 'Lasting opportunities.'),
  lead: text(
    'कतरीसराय और आसपास के क्षेत्रों के युवाओं के लिए उच्च शिक्षा का एक सुलभ मार्ग।',
    'An accessible path to higher education for the young people of Katrisarai ' +
      'and the surrounding communities.',
  ),
  body: [
    text(
      'बिहार सरकार द्वारा स्थापित राजकीय डिग्री महाविद्यालय, कतरीसराय, नालन्दा, पाटलिपुत्र ' +
        'विश्वविद्यालय, पटना की एक अंगीभूत इकाई है। महाविद्यालय में कला संकाय के अंतर्गत भाषा, ' +
        'मानविकी और सामाजिक विज्ञान के छह विषयों में स्नातक स्तर की पढ़ाई होती है।',
      'Established by the Government of Bihar, Government Degree College, ' +
        'Katrisarai, Nalanda is a constituent unit of Patliputra University, ' +
        'Patna. The college offers undergraduate study in the arts, with six ' +
        'subjects spanning languages, humanities and social sciences.',
    ),
    text(
      'ग्रामीण परिवेश में स्थित हमारा महाविद्यालय शिक्षा को समुदाय के करीब लाता है और ' +
        'विद्यार्थियों को ज्ञान, आत्मविश्वास तथा उज्ज्वल भविष्य की नींव तैयार करने में सहयोग देता है।',
      'Our rural setting brings learning closer to the community, supporting ' +
        'students as they build knowledge, confidence and a foundation for ' +
        'their future.',
    ),
  ] as readonly Text[],
  profileLink: text('महाविद्यालय का परिचय पढ़ें', 'Read the college profile'),
  /** The supplied profile, shipped as-is from `public/`. */
  profileHref: '/college-profile.pdf',
} as const;

/**
 * The four figures under the welcome.
 *
 * Each is a fact from the college profile or the university directory, and
 * none of them is a claim about quality — no pass rates, no placement
 * percentages, nothing this site would be inventing. `06` and `11` are
 * zero-padded so the row sets as four numbers of the same weight rather than
 * two short ones and two long.
 */
export const FACTS: readonly { readonly figure: string; readonly label: Text }[] = [
  { figure: '06', label: text('स्नातक स्तर के विषय', 'Undergraduate subjects') },
  { figure: '11', label: text('शिक्षक', 'Teaching faculty') },
  { figure: '2026', label: text('स्थापना वर्ष', 'Year of establishment') },
  { figure: '245', label: text('विश्वविद्यालय महाविद्यालय कोड', 'University college code') },
];
