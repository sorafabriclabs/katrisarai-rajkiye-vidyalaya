import {
  DestroyRef,
  Directive,
  ElementRef,
  Injectable,
  afterNextRender,
  inject,
} from '@angular/core';

/**
 * One `IntersectionObserver` for the whole site.
 *
 * A page carries a dozen or more revealed elements and an observer per element
 * is a dozen observers watching the same scroll. They are cheap individually
 * and the browser still has to visit every one of them on every frame the
 * viewport moves.
 *
 * The observer itself adds the class and stops watching. There is nothing to
 * call back into: a revealed element is finished, and the directive's only
 * remaining job is to stop watching an element that leaves before it arrived.
 */
@Injectable({ providedIn: 'root' })
export class RevealObserver {
  private observer?: IntersectionObserver;

  observe(element: Element): void {
    // No observer, no reveal — so reveal it now rather than never.
    //
    // The failure this prevents is total: a revealed element sits at
    // `opacity: 0` until something adds the class, so an environment without
    // `IntersectionObserver` gets a page with a header, a footer and nothing
    // in between. Every browser the site supports has it; the ones that turn
    // out not to are, by definition, the ones nobody tested in — which, for a
    // site read on whatever handset is in the village, is not a small set.
    if (!('IntersectionObserver' in globalThis)) {
      element.classList.add('visible');
      return;
    }

    this.observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('visible');
          this.observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.1 },
    );
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.observer?.unobserve(element);
  }
}

/**
 * Fades an element up as it scrolls into view.
 *
 * The `reveal` class is applied by the host binding, which means the server
 * sends it too: the first paint is already in the pre-reveal state and nothing
 * jumps when Angular hydrates. `index.html` carries a `<noscript>` rule that
 * cancels it, because an element left at `opacity: 0` waiting for an observer
 * that will never run is a blank page.
 *
 * `afterNextRender` is what keeps this off the server, where there is no
 * viewport to intersect with and no `IntersectionObserver` to ask.
 */
@Directive({
  selector: '[appReveal]',
  host: { class: 'reveal' },
})
export class Reveal {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const reveals = inject(RevealObserver);

    afterNextRender(() => reveals.observe(element));
    inject(DestroyRef).onDestroy(() => reveals.unobserve(element));
  }
}
