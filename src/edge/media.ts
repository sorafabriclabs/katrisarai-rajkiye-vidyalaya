/**
 * Files the office uploads: the banner photograph, and PDFs hung off notices.
 *
 * They live in R2 and are served by the Worker at `/media/<key>`, which is why
 * `server.cloudflare.ts` has to match that prefix *before* its static-asset
 * branch — `/media/notice.png` ends in `.png`, and the asset layer would
 * otherwise answer 404 for it and never reach this file.
 */

/** The slice of R2's interface this file uses. */
export interface Bucket {
  get(key: string): Promise<BucketObject | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface BucketObject {
  body: ReadableStream | null;
  size: number;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?(headers: Headers): void;
}

/**
 * What may be uploaded, and what it is called on the way out.
 *
 * An allow-list rather than a block-list, and the extension is derived from
 * this table rather than from the uploader's filename. A notice board that
 * serves whatever it is handed, under whatever name it is handed, is a file
 * host with the college's name on it.
 *
 * SVG is deliberately absent. It is an image everywhere else and a script
 * everywhere that matters: an SVG served from this origin can carry JavaScript
 * that runs as the college's own site.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Ten megabytes. A scanned university circular is under one. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface StoredFile {
  readonly url: string;
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export type UploadError =
  | { ok: false; reason: 'type'; detail: string }
  | { ok: false; reason: 'size'; detail: string }
  | { ok: false; reason: 'empty'; detail: string };

/**
 * Stores an upload under a key derived from its own bytes.
 *
 * # Why the content hash rather than a random id
 *
 * Two things fall out of it for free. The same file uploaded twice is one
 * object rather than two, which matters when the office re-uploads a circular
 * it has already posted. And the key can never refer to different bytes later,
 * so `/media/<key>` is genuinely immutable and can be served with a one-year
 * cache — no revalidation, no thinking about invalidation at all.
 *
 * The uploader's filename is *not* in the key. It is kept separately, as the
 * link's text, where it is escaped as ordinary content; putting it in a path
 * means worrying about traversal, encoding and duplicates forever.
 */
export async function storeUpload(
  bucket: Bucket,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<StoredFile | UploadError> {
  const type = contentType.split(';')[0].trim().toLowerCase();
  const extension = ALLOWED[type];
  if (!extension) {
    return { ok: false, reason: 'type', detail: `${type || 'unknown'} is not an allowed type` };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, reason: 'empty', detail: 'the file is empty' };
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'size', detail: `over ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` };
  }

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `${hex}.${extension}`;

  await bucket.put(key, bytes, { httpMetadata: { contentType: type } });

  return { url: `/media/${key}`, key, contentType: type, sizeBytes: bytes.byteLength };
}

/** Whether a stored file failed to store. Narrows the union for the caller. */
export function isUploadError(result: StoredFile | UploadError): result is UploadError {
  return (result as UploadError).ok === false;
}

/**
 * Serves a stored file.
 *
 * The key is checked against the shape `storeUpload` produces rather than
 * being passed through — R2 keys are not paths and `..` means nothing to it,
 * but a permissive reader here is how a bucket with anything else in it later
 * becomes readable from the public web.
 *
 * `immutable` because the key is the content's own hash: this response can
 * never be wrong, so a browser should never ask about it again.
 */
export async function serveMedia(bucket: Bucket, key: string): Promise<Response> {
  if (!/^[0-9a-f]{32}\.(jpg|png|webp|pdf)$/.test(key)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const object = await bucket.get(key);
  if (!object || !object.body) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const headers = new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(object.size),
    // A PDF the office uploaded is displayed, but it is still a file from
    // outside the codebase served from the site's own origin. `nosniff` stops
    // a browser deciding it is HTML, and the sandbox denies it scripts and
    // same-origin access if it ever is.
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  });
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');

  return new Response(object.body, { status: 200, headers });
}
