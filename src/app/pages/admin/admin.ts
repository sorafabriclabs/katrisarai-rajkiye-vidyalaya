import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ADMIN } from '../../content/notices.content';
import { NoticeStore } from '../../notices/notice-store';
import { Notice, NoticeAttachment } from '../../../model/notice';
import { resizeImage } from '../../notices/resize-image';

/**
 * The notice board's admin area.
 *
 * # What protects it
 *
 * Cloudflare Access, in front of the deployment — not this component. By the
 * time this page loads, the visitor has already signed in, and every request
 * it makes carries a signed assertion the Worker verifies (`edge/access.ts`).
 * There is no password here, no session, no "are you an admin?" check that
 * could be wrong, and nothing on this page is a security boundary: hiding the
 * form from someone who reached it would protect nothing, because the API is
 * what refuses them.
 *
 * `/api/session` is called on load anyway — not to authorise, but to show
 * whose name is on the notices, and to fail loudly and early if the Access
 * configuration is broken rather than on the first attempt to publish.
 */
@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly http = inject(HttpClient);
  private readonly store = inject(NoticeStore);
  private readonly fb = inject(FormBuilder);

  protected readonly copy = ADMIN;
  protected readonly notices = this.store.notices;

  protected readonly email = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly status = signal<{ text: string; error: boolean } | null>(null);

  /** The notice being edited, or `null` when the form is a new one. */
  protected readonly editing = signal<string | null>(null);
  protected readonly attachment = signal<NoticeAttachment | null>(null);
  protected readonly bannerUrl = this.store.bannerUrl;

  protected readonly heading = computed(() =>
    this.editing() ? this.copy.saveEdit : this.copy.save,
  );

  protected readonly form = this.fb.nonNullable.group({
    postedAt: [today(), [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    titleHi: ['', Validators.required],
    titleEn: [''],
    bodyHi: ['', Validators.required],
    bodyEn: [''],
    pinned: [false],
  });

  constructor() {
    void this.loadSession();
  }

  private async loadSession(): Promise<void> {
    try {
      const session = await firstValueFrom(this.http.get<{ email: string }>('/api/session'));
      this.email.set(session.email);
    } catch {
      this.status.set({
        text: 'Could not confirm your sign-in. Reload the page, or check that Cloudflare Access is configured for this deployment.',
        error: true,
      });
    }
  }

  protected startNew(): void {
    this.editing.set(null);
    this.attachment.set(null);
    this.form.reset({
      postedAt: today(),
      titleHi: '',
      titleEn: '',
      bodyHi: '',
      bodyEn: '',
      pinned: false,
    });
    this.status.set(null);
  }

  protected startEdit(notice: Notice): void {
    this.editing.set(notice.id);
    this.attachment.set(notice.attachment);
    this.form.setValue({
      postedAt: notice.postedAt,
      // The stored row may have had no English, in which case the model filled
      // it from the Hindi. Putting that back in the English box would turn a
      // deliberate blank into a duplicate on the next save.
      titleHi: notice.title.hi,
      titleEn: notice.title.en === notice.title.hi ? '' : notice.title.en,
      bodyHi: notice.body.hi,
      bodyEn: notice.body.en === notice.body.hi ? '' : notice.body.en,
      pinned: notice.pinned,
    });
    this.status.set(null);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.status.set({
        text: 'Fill in the date, the Hindi title and the Hindi notice.',
        error: true,
      });
      return;
    }

    const id = this.editing();
    const body = { ...this.form.getRawValue(), attachment: this.attachment() };

    await this.send(
      id
        ? this.http.put<{ notices: Notice[] }>(`/api/notices/${id}`, body)
        : this.http.post<{ notices: Notice[] }>('/api/notices', body),
      id ? 'Notice updated.' : 'Notice published.',
      () => this.startNew(),
    );
  }

  protected async remove(notice: Notice): Promise<void> {
    // A published notice is the one thing here that other people are acting
    // on — an exam date, an admission deadline. Deleting it is not undoable
    // from this page, so it is confirmed.
    if (!confirm(`Withdraw “${notice.title.hi}”? This cannot be undone.`)) return;

    await this.send(
      this.http.delete<{ notices: Notice[] }>(`/api/notices/${notice.id}`),
      'Notice withdrawn.',
      () => {
        if (this.editing() === notice.id) this.startNew();
      },
    );
  }

  /** Runs a request, reports what happened, and keeps the list in step. */
  private async send(
    request: { subscribe: unknown } & Parameters<typeof firstValueFrom>[0],
    success: string,
    after?: () => void,
  ): Promise<void> {
    this.busy.set(true);
    this.status.set(null);
    try {
      const result = (await firstValueFrom(request)) as { notices: Notice[] };
      this.store.replace(result.notices);
      this.status.set({ text: `${success} ${this.copy.cacheNote}`, error: false });
      after?.();
    } catch (error) {
      this.status.set({ text: message(error), error: true });
    } finally {
      this.busy.set(false);
    }
  }

  // ── Files ────────────────────────────────────────────────────────────

  protected async chooseAttachment(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const stored = await this.upload(file);
    if (stored) this.attachment.set(stored);
  }

  protected clearAttachment(): void {
    this.attachment.set(null);
  }

  protected async chooseBanner(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const stored = await this.upload(file);
    if (!stored) return;

    await this.setBanner(stored.url);
  }

  protected async clearBanner(): Promise<void> {
    await this.setBanner('');
  }

  private async setBanner(url: string): Promise<void> {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(
        this.http.put<{ url: string | null }>('/api/banner', { url }),
      );
      this.bannerUrl.set(result.url);
      this.status.set({
        text: `${url ? 'Banner updated.' : 'Default banner restored.'} ${this.copy.cacheNote}`,
        error: false,
      });
    } catch (error) {
      this.status.set({ text: message(error), error: true });
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Uploads a file, resizing it first if it is an image.
   *
   * # Why the resize is here rather than on the server
   *
   * Because a Worker cannot do it. There is no image library in that runtime,
   * and Cloudflare's own resizing is a paid add-on — so the realistic choices
   * were to resize in the browser, or to store whatever the phone produced.
   * The second is not really a choice: a photograph straight off a modern
   * handset is four or five megabytes and four thousand pixels wide, and it
   * would be sent, in full, to every visitor on a 3G connection in Katrisarai.
   *
   * PDFs pass through untouched. Nothing here can usefully shrink one, and the
   * university's circulars are already small.
   */
  private async upload(file: File): Promise<NoticeAttachment | null> {
    this.busy.set(true);
    this.status.set(null);
    try {
      const prepared = file.type.startsWith('image/') ? await resizeImage(file) : file;

      const result = await firstValueFrom(
        this.http.post<{ url: string; name: string; sizeBytes: number }>(
          '/api/media',
          await prepared.arrayBuffer(),
          {
            headers: {
              'Content-Type': prepared.type,
              // The filename travels in a header rather than in the body, and
              // is encoded because a header may not carry Devanagari — an
              // unencoded "परीक्षा.pdf" is not a legal header value.
              'X-Upload-Name': encodeURIComponent(file.name),
            },
          },
        ),
      );
      return { url: result.url, name: result.name, sizeBytes: result.sizeBytes };
    } catch (error) {
      this.status.set({ text: message(error), error: true });
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  protected invalid(field: 'postedAt' | 'titleHi' | 'bodyHi'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}

/** Today, as `YYYY-MM-DD` in the local timezone — which is what the office means. */
function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The server's own message where there is one, rather than a status code. */
function message(error: unknown): string {
  const body = (error as { error?: { error?: string } })?.error;
  if (body && typeof body.error === 'string') return body.error;
  const status = (error as { status?: number })?.status;
  if (status === 401) return 'Your sign-in has expired. Reload the page to sign in again.';
  return 'Something went wrong. Please try again.';
}
