import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { Translator } from './i18n/language';
import { Seo } from './shared/seo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      /*
       * `scrollPositionRestoration: 'enabled'` is what puts a visitor at the
       * top of the page they navigated to rather than at the scroll offset
       * they left the last one at — and returns them to where they were when
       * they press back. `anchorScrolling` is on for the handful of in-page
       * links, notably the footer's "back to top".
       */
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    /*
     * `withEventReplay` records clicks and taps that land between the server's
     * HTML appearing and Angular taking over, and replays them once it has.
     * The language switch is the control this matters most for: it is in the
     * top bar, it is the first thing a reader who wants English reaches for,
     * and it is precisely in the window where a tap is otherwise lost.
     */
    provideClientHydration(withEventReplay()),
    /*
     * Both started here rather than from the shell component so that they are
     * running before the first navigation completes — including the single
     * navigation a server render performs, which is the only one a crawler
     * ever sees.
     */
    provideAppInitializer(() => {
      inject(Translator).start();
      inject(Seo).start();
    }),
  ],
};
