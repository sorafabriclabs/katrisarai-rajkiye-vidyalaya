/**
 * Shrinks an image in the browser before it is uploaded.
 *
 * A photograph from a current handset is four or five megabytes and four
 * thousand pixels across. The banner is displayed at 2200px at most, and every
 * visitor on a phone in Katrisarai pays for the difference on every page load.
 *
 * This runs in the browser because it cannot run anywhere else: the Worker has
 * no image library, and Cloudflare's own resizing is a paid add-on. The browser
 * already has a decoder and a canvas.
 */

/** Wide enough for the hero at 2× on a laptop, and no wider. */
const MAX_EDGE = 2400;

/** JPEG quality. Above ~0.85 the file grows fast and the photograph does not improve. */
const QUALITY = 0.85;

/**
 * Returns a resized JPEG, or the original file when resizing would not help
 * or cannot be done.
 *
 * Every failure path returns the original rather than throwing. A banner that
 * uploads at full size is a slow page; a banner that cannot be uploaded at all
 * because the canvas was tainted, the format was exotic, or the image was
 * enormous enough to exhaust memory is a feature that does not work. The
 * Worker enforces the real limit either way.
 */
export async function resizeImage(file: File): Promise<File> {
  // Nothing to gain: already small, and not a format a canvas improves.
  if (file.size < 400 * 1024) return file;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already within bounds — re-encoding would only lose detail.
    if (scale === 1 && file.type === 'image/jpeg') {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    // A PNG with transparency becomes black on a JPEG, which is how a logo
    // with a clear background turns into a black rectangle. White first.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });

    // If the "optimised" version is larger — which happens with flat graphics
    // that PNG compresses far better than JPEG — keep the original.
    if (blob.size >= file.size) return file;

    return new File([blob], replaceExtension(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function replaceExtension(name: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.jpg`;
}
