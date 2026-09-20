import { DOCUMENT, Injectable, afterNextRender, effect, inject, signal } from '@angular/core';

import { Text } from '../../model/text';

/**
 * The two languages the site is written in.
 *
 * Hindi first, and Hindi is the default: this is a rural Bihar government
 * college whose students, their parents and the district office all read
 * Devanagari, and English is the second language here rather than the
 * fallback everything degrades to.
 */
export type Language = 'hi' | 'en';

/*
 * `Text` and its constructors live in `src/model/text.ts`, with no Angular
 * imports, because the Worker builds them out of D1 rows and may not import
 * this file. They are re-exported here so that everything in `app/` can keep
 * treating this as the one place i18n comes from.
 */
export { type Text, text, textOrFallback } from '../../model/text';

/** Where the choice is kept between visits. Shared with the static site it replaces. */
const STORAGE_KEY = 'college-language';

/**
 * Which language the site is being read in, and the function that resolves a
 * `Text` against it.
 *
 * # Why this rather than Angular's own i18n
 *
 * `@angular/localize` builds one bundle per locale and serves them from
 * different URLs — `/hi/` and `/en/` — which is the right answer for a site
 * with a lot of text and a translation workflow. This site has perhaps four
 * hundred words, both languages are written by the same person in the same
 * commit, and a visitor switching language should not navigate. One bundle
 * holding both, toggled by a signal, costs a few kilobytes and removes the
 * build matrix, the per-locale deployment, and the question of what `/` does.
 *
 * The cost is honest and worth writing down: a crawler sees one language per
 * URL, and that language is Hindi. See `start()`.
 *
 * # Reading it in a template
 *
 * Components expose `t` and call it directly:
 *
 * ```html
 * <h2>{{ t(about.title) }}</h2>
 * ```
 *
 * `t` reads the `language` signal, so the template that calls it is subscribed
 * to it — switching language marks exactly the views that displayed text as
 * dirty, with no pipe, no subscription and no `markForCheck`.
 */
@Injectable({ providedIn: 'root' })
export class Translator {
  private readonly document = inject(DOCUMENT);

  /**
   * The language being displayed.
   *
   * Starts at `hi` on both the server and the client, which is what keeps
   * hydration honest: the client's first render must match the markup the
   * server sent, and the server cannot know what this visitor chose last time.
   */
  readonly language = signal<Language>('hi');

  /** Resolves a `Text`. Written as a field so templates can call it unbound. */
  readonly t = (value: Text): string => value[this.language()];

  constructor() {
    /*
     * `<html lang>` follows the signal.
     *
     * It is not decoration. A screen reader picks its voice and its
     * pronunciation rules from it, and Devanagari read by an English voice is
     * unintelligible rather than merely accented. The stylesheet also hangs
     * the whole Devanagari type scale off `html[lang='hi']`, because the two
     * scripts do not share a comfortable size or line height.
     *
     * This runs during the server render too, so the document arrives already
     * saying `lang="hi"`.
     */
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }

  /**
   * Restores the visitor's previous choice, once.
   *
   * # Why `afterNextRender` and not an initializer
   *
   * Reading storage during bootstrap would change the signal *before*
   * hydration, so Angular would compare a Hindi document against an English
   * render and tear the page down to rebuild it. After the next render,
   * hydration is finished and a language change is an ordinary signal update:
   * the text swaps, nothing is re-created, and the visitor who chose English
   * sees Hindi for one frame.
   *
   * That frame is the price of server-rendering one language and caching it
   * for everyone. The alternative — keying the render on a cookie — would make
   * every page two entries in the edge cache and put a `Set-Cookie` on
   * documents that `worthCaching` then refuses to store at all.
   *
   * # Why the try/catch
   *
   * `localStorage` throws rather than returning null when a browser is in
   * private mode or has site data blocked, and it throws on *access*, not on
   * use. An uncaught one here would take the whole application down over a
   * preference.
   */
  start(): void {
    afterNextRender(() => {
      const stored = read();
      if (stored && stored !== this.language()) this.language.set(stored);
    });
  }

  /** Switches language and remembers it. Called by the header's switch. */
  use(language: Language): void {
    this.language.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage unavailable. The choice still applies to this page view, which
      // is the part the visitor asked for.
    }
  }
}

function read(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'hi' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
}
