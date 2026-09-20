import { Text, text } from '../i18n/language';
import { DepartmentKey } from './academics.content';

/**
 * Who teaches here.
 *
 * # Why a name is a `Text` and not a string
 *
 * Because a name is written differently in the two scripts and neither
 * spelling is the "real" one. A student looking for डॉ. कुंदन कुमार पासवान on
 * the Hindi page and a university form asking for Dr. Kundan Kumar Paswan are
 * the same person, and only one of those is findable with the browser's own
 * search on a page set in the other script.
 *
 * # What is deliberately not here
 *
 * No email addresses, no photographs, no qualifications, no room numbers. The
 * college profile supplies names and departments; everything else would be
 * invented, and inventing a teacher's credentials on a government college's
 * website is not a small error. The one contact route the site offers is the
 * principal's number, which the university already publishes.
 */

export interface Department {
  /** The same key the subject carries, which is what `faculty.spec.ts` checks. */
  readonly key: DepartmentKey;
  readonly name: Text;
  /** The department name in Devanagari, shown beside the English one. */
  readonly devanagari: string;
  readonly members: readonly Text[];
}

/** The principal in charge, who is the college's academic and administrative head. */
export const PRINCIPAL = {
  eyebrow: text('प्रभारी प्राचार्य', 'PRINCIPAL IN CHARGE'),
  name: text('प्रो. रामकृष्ण परमहंस', 'Prof. Ram Krishna Paramhans'),
  devanagari: 'प्रो. रामकृष्ण परमहंस',
  role: text('शैक्षणिक नेतृत्व एवं प्रशासन', 'Academic leadership & administration'),
  photo: {
    src: '/assets/principal.jpg',
    alt: text('प्राचार्य प्रो. रामकृष्ण परमहंस', 'Principal Prof. Ram Krishna Paramhans'),
  },
} as const;

/**
 * The six departments, in the order the college profile lists them — which is
 * also the order of `SUBJECTS`, and is the university's own ordering rather
 * than alphabetical in either script.
 *
 * Economics has one teacher where the others have two. That is what the
 * profile says, and the template does not special-case it: a department of one
 * renders as a list of one.
 */
export const DEPARTMENTS: readonly Department[] = [
  {
    key: 'hindi',
    name: text('हिंदी', 'Hindi'),
    devanagari: 'हिंदी',
    members: [text('पंकज कुमार', 'Pankaj Kumar'), text('रौशन कुमार', 'Raushan Kumar')],
  },
  {
    key: 'english',
    name: text('अंग्रेजी', 'English'),
    devanagari: 'अंग्रेजी',
    members: [text('प्रियांशु प्रिया', 'Priyanshu Priya'), text('नेहा कुमारी', 'Neha Kumari')],
  },
  {
    key: 'history',
    name: text('इतिहास', 'History'),
    devanagari: 'इतिहास',
    members: [
      text('डॉ. कुंदन कुमार पासवान', 'Dr. Kundan Kumar Paswan'),
      text('डॉ. निशा कुमारी', 'Dr. Nisha Kumari'),
    ],
  },
  {
    key: 'political-science',
    name: text('राजनीति विज्ञान', 'Political Science'),
    devanagari: 'राजनीति विज्ञान',
    members: [
      text('डॉ. भवतोष भास्कर', 'Dr. Bhavtosh Bhaskar'),
      text('संजीव कुमार', 'Sanjeev Kumar'),
    ],
  },
  {
    key: 'sociology',
    name: text('समाजशास्त्र', 'Sociology'),
    devanagari: 'समाजशास्त्र',
    members: [
      text('डॉ. कुमारी प्रियंका राज', 'Dr. Kumari Priyanka Raj'),
      text('रंगोली पाण्डेय', 'Rangoli Pandey'),
    ],
  },
  {
    key: 'economics',
    name: text('अर्थशास्त्र', 'Economics'),
    devanagari: 'अर्थशास्त्र',
    members: [text('अभिषेक आनंद', 'Abhishek Anand')],
  },
];

export const FACULTY = {
  eyebrow: text('शिक्षा को समर्पित हमारे शिक्षक', 'THE PEOPLE BEHIND THE LEARNING'),
  title: text('मिलिए हमारे', 'Meet our'),
  titleAccent: text('शिक्षकों से।', 'faculty.'),
  lead: text(
    'महाविद्यालय के परिचय के अनुसार, हमारे छह विभागों में 11 सहायक प्राध्यापक (संविदा) कार्यरत हैं।',
    'Our six departments are supported by 11 assistant professors ' +
      '(contractual), as listed in the college profile.',
  ),
  /**
   * The office, which the profile records and which a visitor turning up with
   * a form needs to know exists. One line, because one line is what is known.
   */
  office: {
    eyebrow: text('कार्यालय', 'COLLEGE OFFICE'),
    body: text(
      'कार्यालयीय कार्यों के संचालन हेतु श्री भोला प्रसाद दिनचरिया लिपिक के रूप में कार्यरत हैं।',
      'Office work is handled by Shri Bhola Prasad, Dinchariya Lipik.',
    ),
  },
} as const;
