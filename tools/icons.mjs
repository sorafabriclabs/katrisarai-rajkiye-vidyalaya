#!/usr/bin/env node
/**
 * tools/icons.mjs
 *
 * Renders every icon the site ships from the college's own emblem, so the
 * favicon, the home-screen icon and the mark in the masthead cannot drift
 * apart. Run it whenever `public/assets/college-mark.png` changes; never edit
 * an output by hand.
 *
 *   node tools/icons.mjs
 *
 * The emblem is a colour seal on white and is wider than it is tall, so it is
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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'public/assets/college-mark.png');

/**
 * The ground a padded icon sits on.
 *
 * White, which is both the emblem's own background and the page's. Anything
 * else draws a visible rectangle where the padding meets the seal.
 */
const GROUND = 'FFFFFF';

/** The square canvas the mark is centred on before anything is resized. */
const CANVAS = 1080;

/** Every square icon the site links to, by edge length. */
const SIZES = {
  'public/icon-512.png': 512,
  'public/icon-192.png': 192,
  'public/apple-touch-icon.png': 180,
  'public/favicon-32x32.png': 32,
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
  // Square first, then down. Padding after a resize would round the mark's
  // edges twice and soften the diagonals it is mostly made of.
  const square = join(work, 'square.png');
  sips('-p', String(CANVAS), String(CANVAS), '--padColor', GROUND, SOURCE, '--out', square);

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
