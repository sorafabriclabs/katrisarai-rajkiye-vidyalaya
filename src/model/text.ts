/**
 * A string the site says, in both languages.
 *
 * # Why this is here and not in `app/i18n/language.ts`
 *
 * It started there, beside the `Translator` that resolves it. It moved because
 * the Worker needs it too: a notice comes out of D1 as two columns and has to
 * become a `Text` before it reaches Angular, and `language.ts` imports
 * `@angular/core`. Nothing in `src/edge/` may import Angular — that bundle is
 * built for a neutral platform and pulling the framework into it would be both
 * enormous and pointless.
 *
 * So the type and its constructor live here, with no dependencies at all, and
 * `language.ts` re-exports them. Every existing import still works.
 */
export interface Text {
  readonly hi: string;
  readonly en: string;
}

/** Shorthand for building one, so the content files read as prose. */
export function text(hi: string, en: string): Text {
  return { hi, en };
}

/**
 * Builds a `Text` where the English is optional and falls back to the Hindi.
 *
 * This is for content that arrives from the notice board rather than from a
 * content file. The office writes in Hindi; asking for both languages on every
 * notice would mean either a second field nobody fills in or — worse — a
 * half-translated page, and an English reader is better served by the Hindi
 * notice than by a blank one.
 *
 * The compiler-enforced pairing in `content/` is unaffected. That copy is
 * written once by a developer, where there is no excuse for one language.
 */
export function textOrFallback(hi: string, en: string | null | undefined): Text {
  const trimmedHi = hi.trim();
  const trimmedEn = en?.trim();
  return { hi: trimmedHi, en: trimmedEn || trimmedHi };
}
