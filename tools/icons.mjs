#!/usr/bin/env node
/**
 * tools/icons.mjs
 *
 * Renders every icon the site ships, all of them from the college's own seal.
 * Run it whenever `public/assets/college-mark.png` changes; never edit an
 * output by hand.
 *
 *   node tools/icons.mjs
 *
 * # The crop, which is the only trick here
 *
 * The supplied file is 562x512 and **40% of it is white margin** — the seal
 * itself occupies about 415x418 in the middle. Padding that out to a square
 * and resizing, which is the obvious thing to do, spends nearly half of a
 * 32-pixel favicon on empty white and leaves the artwork rendering at around
 * 19 pixels.
 *
 * So it is cropped to the seal first. Same image, same logo, ~40% more pixels
 * for it at every size. That is the whole difference between a favicon you can
 * recognise and one you cannot.
 *
 * The crop is centred and deliberately a little loose (460px against a 418px
 * seal): the seal sits a few pixels off-centre in the file, and a crop sized
 * exactly to it would shave its navy rim on one side.
 *
 * `sips` is macOS's own image tool and is the only dependency: adding sharp to
 * a college website to resize five files once in a while is not a trade worth
 * making. On a machine without it — a Linux CI runner — this script is the one
 * thing here that does not run, which is why its outputs are committed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The college's seal. Every icon on the site comes from this one file. */
const SEAL = join(ROOT, 'public/assets/college-mark.png');

/**
 * The ground behind the seal.
 *
 * White, which is the seal's own background. An icon left transparent is
 * composited by iOS onto black, which puts a dark ring around a seal whose
 * own outer edge is navy.
 */
const GROUND = 'FFFFFF';

/**
 * The square the seal is cropped to, before anything is resized.
 *
 * 460 against a seal of about 418: loose enough that the few pixels the seal
 * sits off-centre by cannot shave its rim, tight enough to drop most of the
 * 40% of the file that is margin.
 */
const CROP = 460;

/** Every icon the site links to, by edge length. */
const SIZES = {
  'public/icon-512.png': 512,
  'public/icon-192.png': 192,
  'public/apple-touch-icon.png': 180,
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
  // Crop to the seal, flatten onto white, then resize down from that one
  // square. Cropping after a resize would throw away pixels and then magnify
  // what was left; padding after would round the rim twice.
  const square = join(work, 'square.png');
  sips('-c', String(CROP), String(CROP), SEAL, '--out', square);
  sips('-p', String(CROP), String(CROP), '--padColor', GROUND, square, '--out', square);

  for (const [output, size] of Object.entries(SIZES)) {
    sips('-z', String(size), String(size), square, '--out', join(ROOT, output));
    console.log(`  ${output}  ${size}×${size}`);
  }

  const favicon = join(ROOT, 'public/favicon.ico');
  writeFileSync(favicon, icoFromPng(readFileSync(join(ROOT, 'public/favicon-32x32.png')), 32));
  console.log('  public/favicon.ico  32×32 (PNG payload)');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('\n✅ Icons rendered from public/assets/college-mark.png');
