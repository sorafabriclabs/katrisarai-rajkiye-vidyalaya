import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Translator } from '../i18n/language';
import { SiteHeader } from './site-header';

@Component({ template: '' })
class Blank {}

/**
 * The header is the one component on every page, and it owns the two controls
 * that are wrong everywhere if they are wrong at all: which link is marked as
 * the current page, and the language switch.
 */
describe('SiteHeader', () => {
  let router: Router;
  let translator: Translator;

  const render = async () => {
    const fixture = TestBed.createComponent(SiteHeader);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: Blank },
          { path: 'notices', component: Blank },
          { path: 'academics', component: Blank },
          { path: 'faculty', component: Blank },
          { path: 'contact', component: Blank },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    translator = TestBed.inject(Translator);
  });

  it('marks the current page, and only the current page', async () => {
    await router.navigateByUrl('/academics');
    const fixture = await render();

    const current = [
      ...fixture.nativeElement.querySelectorAll('.nav-links a[aria-current="page"]'),
    ] as HTMLElement[];
    expect(current.map((a) => a.textContent?.trim())).toEqual(['शैक्षणिक विषय']);
  });

  it('starts in Hindi, which is what the server renders', async () => {
    await router.navigateByUrl('/');
    const fixture = await render();

    const links = [...fixture.nativeElement.querySelectorAll('.nav-links a')] as HTMLElement[];
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'मुखपृष्ठ',
      'सूचना पट्ट',
      'शैक्षणिक विषय',
      'शिक्षक',
      'विद्यार्थी संसाधन',
      'संपर्क',
    ]);
  });

  it('rewrites the navigation when the language changes', async () => {
    await router.navigateByUrl('/');
    const fixture = await render();

    translator.use('en');
    await fixture.whenStable();
    fixture.detectChanges();

    const links = [...fixture.nativeElement.querySelectorAll('.nav-links a')] as HTMLElement[];
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Home',
      'Notices',
      'Academics',
      'Faculty',
      'Student resources',
      'Contact',
    ]);
  });

  it('shows which language is selected, on the button itself', async () => {
    await router.navigateByUrl('/');
    const fixture = await render();

    const pressed = () =>
      [...fixture.nativeElement.querySelectorAll('.language-switch button')]
        .filter((b) => (b as HTMLElement).getAttribute('aria-pressed') === 'true')
        .map((b) => (b as HTMLElement).textContent?.trim());

    // Exactly one, always. Two pressed buttons in a group is a control that
    // says nothing, and zero is a control that says the site has no language.
    expect(pressed()).toEqual(['हिंदी']);

    translator.use('en');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pressed()).toEqual(['English']);
  });

  it('closes the mobile menu when a navigation happens', async () => {
    await router.navigateByUrl('/');
    const fixture = await render();
    const toggle = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;

    toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nav-links').classList).toContain('open');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await router.navigateByUrl('/faculty');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.nav-links').classList).not.toContain('open');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
