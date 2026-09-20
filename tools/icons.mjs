#!/usr/bin/env node
/**
 * tools/icons.mjs
 *
 * Renders every icon the site ships. Run it whenever either source in
 * `public/assets/` changes; never edit an output by hand.
 *
 *   node tools/icons.mjs
 *
 * There are two sources and a size threshold between them — see `SEAL` and
 * `ICON` below for why a downsampled seal cannot be a favicon.
 *
 * The seal is a colour image on white and is wider than it is tall, so it is
 * padded out to a square on white before anything is resized — an icon left
 * transparent is composited by iOS onto black, which puts a dark ring around a
 * seal whose own outer edge is navy.
 *
 * `sips` is macOS's own image tool and is the only dependency: adding sharp to
 * a college website to resize five files once in a while is not a trade worth
 * making. On a machine without it — a Linux CI runner — this script is the one
 * thing here that does not run, which is why its outputs are committed.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The two sources, and why there are two.
 *
 * `college-mark.png` is the real seal — a tree, a lamp, a stupa, and the
 * college's name set around the rim. It is the right image wherever there is
 * room for it: the masthead at 84px, a home-screen tile at 180px and up.
 *
 * `college-icon.svg` is a drawn mark in the same colours: the seal's open
 * book, and nothing else. It exists because a browser tab gives an icon 16 or
 * 32 pixels, and at that size every element of the seal is under two pixels —
 * downsampling it produces a gold-brown smudge, not a small logo. The only
 * way to have a legible favicon is to draw one.
 *
 * The split is at 180px, which is where the seal's rim lettering starts to
 * resolve.
 */
const SEAL = join(ROOT, 'public/assets/college-mark.png');
const ICON = join(ROOT, 'public/assets/college-icon.svg');

/**
 * The ground a padded icon sits on.
 *
 * White, which is both the emblem's own background and the page's. Anything
 * else draws a visible rectangle where the padding meets the seal.
 */
const GROUND = 'FFFFFF';

/** The square canvas the mark is centred on before anything is resized. */
const CANVAS = 1080;

/** The large icons, downsampled from the seal. */
const SEAL_SIZES = {
  'public/icon-512.png': 512,
  'public/icon-192.png': 192,
  'public/apple-touch-icon.png': 180,
};

/** The tab-sized icons, rasterised from the drawn mark. */
const ICON_SIZES = {
  'public/favicon-32x32.png': 32,
  'public/favicon-16x16.png': 16,
};

const sips = (...args) => execFileSync('sips', args, { stdio: 'pipe' });

/**
 * An .ico wrapping a single PNG.
 *
 * The format has allowed a PNG payload in place of a BMP since Windows Vista,
 * and every browser that matters reads it — which is the whole reason this can
 * be eight lines of buffer writing instead of a BMP encoder or a dependency.
 *
 * Layout: a 6-byte header (reserved, type 1 = icon, one image), then one
 * 16-byte directory entry, then the PNG itself. A 256-pixel edge is written as
 * 0 by the spec; nothing here is that large, but the `& 0xff` says so.
 */
function icoFromPng(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size & 0xff, 0); // width
  entry.writeUInt8(size & 0xff, 1); // height
  entry.writeUInt8(0, 2); // palette colours: none, it is a PNG
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const work = mkdtempSync(join(tmpdir(), 'katrisarai-icons-'));
try {
  // Square first, then down. Padding after a resize would round the seal's
  // edges twice and soften the rim it is mostly made of.
  const square = join(work, 'square.png');
  sips('-p', String(CANVAS), String(CANVAS), '--padColor', GROUND, SEAL, '--out', square);

  for (const [output, size] of Object.entries(SEAL_SIZES)) {
    sips('-z', String(size), String(size), square, '--out', join(ROOT, output));
    console.log(`  ${output}  ${size}×${size}  (seal)`);
  }

  // The drawn mark, rasterised straight from the SVG at each size rather than
  // once and downsampled — `sips` renders the vector at the target resolution,
  // so the book's edges stay crisp instead of being resampled twice.
  for (const [output, size] of Object.entries(ICON_SIZES)) {
    sips(
      '-s',
      'format',
      'png',
      '-z',
      String(size),
      String(size),
      ICON,
      '--out',
      join(ROOT, output),
    );
    console.log(`  ${output}  ${size}×${size}  (drawn mark)`);
  }

  // The SVG itself, served to every browser that accepts one — which is all of
  // them now bar old Safari. It is the only icon that is right at every size,
  // including the 24px a pinned tab uses and the display scale factors none of
  // the PNGs above are cut for.
  copyFileSync(ICON, join(ROOT, 'public/icon.svg'));
  console.log('  public/icon.svg     vector (drawn mark)');

  const favicon = join(ROOT, 'public/favicon.ico');
  writeFileSync(favicon, icoFromPng(readFileSync(join(ROOT, 'public/favicon-32x32.png')), 32));
  console.log('  public/favicon.ico  32×32 (PNG payload)');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('\n✅ Icons rendered — seal for 180px and up, drawn mark for the tab.');
