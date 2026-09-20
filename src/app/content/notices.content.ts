import { text } from '../i18n/language';

/** The notice board's own words. The notices themselves come from D1. */
export const NOTICES = {
  eyebrow: text('सूचना पट्ट', 'NOTICE BOARD'),
  title: text('महाविद्यालय की', 'Notices and'),
  titleAccent: text('सूचनाएँ।', 'announcements.'),
  lead: text(
    'परीक्षा, प्रवेश और महाविद्यालय से जुड़ी सूचनाएँ यहाँ प्रकाशित की जाती हैं।',
    'Examination, admission and college announcements are published here.',
  ),

  /**
   * The mark on a recent notice.
   *
   * "नया" rather than a star: an asterisk means a footnote to anyone who has
   * met one, and it has nothing to say to a reader who has not. The word is
   * two letters in Devanagari and says exactly what it means.
   */
  isNew: text('नया', 'New'),
  /** Read out by a screen reader in place of the badge's colour and position. */
  isNewLabel: text('नई सूचना', 'Recently posted'),
  pinned: text('महत्वपूर्ण', 'Important'),

  attachment: text('संलग्न फ़ाइल', 'Attachment'),
  posted: text('प्रकाशित', 'Posted'),

  /** What the page says when the board is empty, which it is on day one. */
  empty: text(
    'इस समय कोई सूचना प्रकाशित नहीं है। नई सूचनाएँ यहाँ प्रकाशित की जाएँगी।',
    'There are no notices at the moment. New announcements will appear here.',
  ),

  /** The heading over the three most recent notices on the landing page. */
  latest: {
    eyebrow: text('ताज़ा सूचनाएँ', 'LATEST NOTICES'),
    title: text('सूचना पट्ट', 'From the notice board'),
    all: text('सभी सूचनाएँ देखें', 'See all notices'),
  },
} as const;

/** The admin area. English only — it is for whoever maintains the site. */
export const ADMIN = {
  title: 'Notice board',
  subtitle: 'Publish and withdraw notices, and replace the banner photograph.',
  signedInAs: 'Signed in as',
  newNotice: 'New notice',
  edit: 'Edit',
  remove: 'Withdraw',
  save: 'Publish',
  saveEdit: 'Save changes',
  cancel: 'Cancel',
  pinned: 'Keep at the top',
  date: 'Date (YYYY-MM-DD)',
  titleHi: 'Title — Hindi (required)',
  titleEn: 'Title — English (optional)',
  bodyHi: 'Notice — Hindi (required)',
  bodyEn: 'Notice — English (optional)',
  attachment: 'Attachment (PDF or image, up to 10MB)',
  removeAttachment: 'Remove attachment',
  banner: 'Banner photograph',
  bannerHelp:
    'Replaces the photograph on the home page. Large images are resized in your ' +
    'browser before upload. Clearing it restores the one built into the site.',
  bannerClear: 'Restore the default banner',
  /**
   * Said plainly on the page, because it is the thing that otherwise looks
   * like a bug. Publishing bumps a stamp the edge cache keys on; the wait is
   * the memo in `contentStamp`, not a deploy.
   */
  cacheNote: 'Published notices appear on the site within about 15 seconds.',
  englishNote:
    'English is optional throughout. Where it is left blank, English readers see the Hindi text.',
} as const;
