import {
  Injectable,
  PLATFORM_ID,
  REQUEST_CONTEXT,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';

import { Notice, byPinnedThenNewest } from '../../model/notice';

/**
 * What the Worker hands the render, and what the server hands the browser.
 *
 * The same shape both times on purpose — see the two halves of the
 * constructor.
 */
export interface NoticeSnapshot {
  readonly notices: readonly Notice[];
  /** The banner the office uploaded, or `null` for the one in the build. */
  readonly bannerUrl: string | null;
  /**
   * When the server rendered. `isNew` needs a clock, and the browser's is the
   * visitor's own — a device whose date is wrong by three months would draw
   * the "new" mark on a different set of notices than the page it hydrated
   * from, and Angular would report a hydration mismatch on a correct page.
   */
  readonly renderedAt: string;
}

const SNAPSHOT = makeStateKey<NoticeSnapshot>('notices');

const EMPTY: NoticeSnapshot = { notices: [], bannerUrl: null, renderedAt: '' };

/**
 * The notice board, as the application sees it.
 *
 * # How the data gets here
 *
 * Not with an HTTP call. The Worker has already read the notices out of D1 by
 * the time it starts the render — it needs them anyway, to decide the cache
 * key — so it passes them straight in through `REQUEST_CONTEXT`, and this
 * writes them into `TransferState` so the browser finds them already in the
 * document.
 *
 * The obvious alternative, an `HttpClient` call to `/api/notices`, would have
 * the Worker issue a request to itself during its own render: a second
 * execution of the same Worker, a second D1 read, and a subrequest whose only
 * purpose is to fetch something the caller is already holding.
 *
 * So there is no loading state on the public pages, and no flash of an empty
 * notice board on hydration. The admin page is the one place that talks to the
 * API, because it is the one place that writes.
 */
@Injectable({ providedIn: 'root' })
export class NoticeStore {
  private readonly transferState = inject(TransferState);

  readonly notices = signal<readonly Notice[]>([]);
  readonly bannerUrl = signal<string | null>(null);

  /**
   * The moment the page was rendered, used to decide what is new.
   *
   * Fixed at render rather than read from the clock, so the server and the
   * browser agree. See `NoticeSnapshot.renderedAt`.
   */
  readonly renderedAt = signal<Date>(new Date(0));

  constructor() {
    const snapshot = isPlatformServer(inject(PLATFORM_ID))
      ? this.fromRequestContext()
      : this.fromTransferState();

    this.notices.set([...snapshot.notices].sort(byPinnedThenNewest));
    this.bannerUrl.set(snapshot.bannerUrl);
    this.renderedAt.set(snapshot.renderedAt ? new Date(snapshot.renderedAt) : new Date());
  }

  /** Replaces the list after an admin write, which answers with the new one. */
  replace(notices: readonly Notice[]): void {
    this.notices.set([...notices].sort(byPinnedThenNewest));
  }

  private fromRequestContext(): NoticeSnapshot {
    // `REQUEST_CONTEXT` is whatever the Worker passed as the second argument
    // to `handle()`. It is `unknown` by construction — Angular cannot know
    // what a given host puts there — so it is checked rather than cast.
    const context = inject(REQUEST_CONTEXT, { optional: true });
    const snapshot = isSnapshot(context) ? context : EMPTY;

    // Written even when empty. A missing key and an empty board are different
    // things to the browser: the first sends it looking for data that is not
    // coming.
    this.transferState.set(SNAPSHOT, snapshot);
    return snapshot;
  }

  private fromTransferState(): NoticeSnapshot {
    const snapshot = this.transferState.get(SNAPSHOT, EMPTY);
    // Read once. Leaving it behind would mean a client-side navigation back to
    // the notice board re-reads the state the first render shipped, rather
    // than whatever the store holds now.
    this.transferState.remove(SNAPSHOT);
    return snapshot;
  }
}

function isSnapshot(value: unknown): value is NoticeSnapshot {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as NoticeSnapshot).notices)
  );
}
