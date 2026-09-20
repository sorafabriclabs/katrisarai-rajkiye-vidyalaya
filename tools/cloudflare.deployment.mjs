#!/usr/bin/env node
/**
 * tools/cloudflare.deployment.mjs
 *
 * Builds the site for Cloudflare and rearranges the output into the layout
 * Cloudflare Pages expects, then optionally deploys it.
 *
 *   node tools/cloudflare.deployment.mjs                 # build + restructure + deploy
 *   node tools/cloudflare.deployment.mjs --prepare-only  # build + restructure (CI)
 *   node tools/cloudflare.deployment.mjs --skip-build    # restructure an existing build
 *   node tools/cloudflare.deployment.mjs --dry-run       # print what it would do
 *
 * Nothing here is configured twice: the output directory and the Pages project
 * name are read from `wrangler.jsonc` and `angular.json`, and the script
 * refuses to run if the two disagree — a mismatch there is a deploy that
 * uploads an empty directory and reports success.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Strips `//` and block comments so a .jsonc file parses as JSON. */
function readJsonc(path) {
  const stripped = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}

const args = process.argv.slice(2);
const opts = {
  dryRun: args.includes('--dry-run'),
  skipBuild: args.includes('--skip-build'),
  prepareOnly: args.includes('--prepare-only'),
};

const wrangler = readJsonc(join(ROOT, 'wrangler.jsonc'));
const angular = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8'));

const PROJECT = 'katrisarai-site';
const cfConfig = angular.projects[PROJECT]?.architect?.build?.configurations?.cloudflare;

if (!cfConfig?.outputPath) {
  console.error(
    `angular.json has no build configuration "cloudflare" with an outputPath for ${PROJECT}.`,
  );
  process.exit(1);
}
if (cfConfig.outputPath !== wrangler.pages_build_output_dir) {
  console.error(
    `wrangler.jsonc pages_build_output_dir (${wrangler.pages_build_output_dir}) ` +
      `does not match angular.json's cloudflare outputPath (${cfConfig.outputPath}).`,
  );
  process.exit(1);
}

const outputPath = cfConfig.outputPath;
const outputDir = join(ROOT, outputPath);
const cfProject = wrangler.name;

/**
 * Pages runs this file for every request and consults the static assets itself
 * — there is no asset layer in front of it. It re-exports the SSR bundle's
 * default export, which is the Worker in `src/server.cloudflare.ts`.
 */
const WORKER_JS_CONTENT = `export { default } from './server/server.mjs';\n`;

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  console.log(`  $ ${cmd}`);
  if (!opts.dryRun) execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

/**
 * What this deployment is called, for the Worker's edge-cache key.
 *
 * The Worker stamps every cached document with this, so a deploy invalidates
 * the edge simply by not matching any key that exists — no purge call, no API
 * token, and no window in which a purge has not run yet. It therefore has to
 * differ on *every* deploy, which is why the clock is in it and not just the
 * commit: two deploys of the same commit are still two deployments, and the
 * second is usually someone redeploying precisely because they want the first
 * one gone.
 */
function buildId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    return `${stamp}-${sha}`;
  } catch {
    // Not a checkout, or no git. The timestamp alone still identifies it.
    return stamp;
  }
}

/**
 * Rearranges the Angular output into Pages' shape:
 *
 *   <out>/browser/**  →  <out>/**        static files at the root
 *   <out>/server/**   →  <out>/server/** unchanged
 *   (generated)       →  <out>/_worker.js
 *   (generated)       →  <out>/__build-id.txt
 */
function restructureForPages() {
  if (opts.dryRun) {
    console.log('  (dry-run) skipping restructure');
    return;
  }
  if (!existsSync(join(outputDir, 'browser')) && existsSync(join(outputDir, '_worker.js'))) {
    console.log('  ✅ Output is already in Cloudflare Pages shape');
    return;
  }
  if (!existsSync(join(outputDir, 'browser'))) {
    throw new Error(
      `${outputPath}/browser does not exist — run the build first, or drop --skip-build.`,
    );
  }

  // Assembled beside the output and swapped in, rather than moved in place: a
  // half-restructured directory is one an interrupted run would leave behind,
  // and the next `--skip-build` would deploy it.
  const tmpDir = `${outputDir}-tmp`;
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  cpSync(join(outputDir, 'browser'), tmpDir, { recursive: true });
  cpSync(join(outputDir, 'server'), join(tmpDir, 'server'), { recursive: true });
  writeFileSync(join(tmpDir, '_worker.js'), WORKER_JS_CONTENT);
  writeFileSync(join(tmpDir, '__build-id.txt'), buildId());
  rmSync(outputDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  cpSync(tmpDir, outputDir, { recursive: true });
  rmSync(tmpDir, { recursive: true });
  console.log('  ✅ Output restructured for Cloudflare Pages');
}

console.log(`\n${'─'.repeat(64)}`);
console.log(
  `🚀 ${opts.prepareOnly ? 'Preparing' : 'Deploying'}: ${PROJECT} → Cloudflare Pages project "${cfProject}"`,
);
console.log(`   Output dir : ${outputPath}`);
console.log(`${'─'.repeat(64)}`);

try {
  if (!opts.skipBuild) {
    run(
      `npx ng build --configuration cloudflare`,
      'Building for Cloudflare (neutral-platform SSR bundle)',
    );
  }
  console.log('\n▶ Restructuring output for Cloudflare Pages');
  restructureForPages();

  if (!opts.prepareOnly) {
    run(
      `npx wrangler pages deploy ${outputPath} --project-name ${cfProject} --branch main --commit-dirty=true`,
      `Deploying to Cloudflare Pages (${cfProject})`,
    );
  } else {
    console.log('\n▶ Skipping deploy (--prepare-only)');
    console.log(`   Output ready at: ${outputPath}`);
  }
  console.log(`\n✅ ${opts.prepareOnly ? 'Prepared' : 'Deployed'} successfully!`);
} catch (err) {
  console.error('\n💥 Deploy failed:', err.message);
  process.exit(1);
}
