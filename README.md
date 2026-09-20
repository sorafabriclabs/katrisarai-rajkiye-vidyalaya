# Government Degree College, Katrisarai

राजकीय डिग्री महाविद्यालय, कतरीसराय, नालन्दा — a constituent unit of Patliputra
University, Patna. Angular 22, server-rendered, bilingual Hindi/English,
deployed to Cloudflare Pages with the render shared between visitors at the
edge.

Five pages and a 404. There is no backend, no database and no API: the whole
site is the route table in `src/app/app.routes.ts` and the copy in
`src/app/content/`.

```
src/
  index.html                 the document: fonts, icons, structured data
  main.ts / main.server.ts   browser and server bootstrap
  server.ts                  Node entry — the default, and what `ng serve` uses
  server.cloudflare.ts       Cloudflare Worker entry — assets, edge cache, render
  edge/cache.ts              the caching rules, with no Cloudflare in them
  styles.scss + styles/      one global stylesheet, one partial per region
  app/
    app.ts                   the shell: header, page, footer
    app.routes.ts            every page, its title and its description
    app.routes.server.ts     how each is rendered, and the 404's status
    content/                 all the copy, as data, in both languages
    i18n/language.ts         the language signal, and the `Text` pair
    layout/                  header, footer, page hero, student desk
    pages/                   home, academics, faculty, students, contact, not-found
    shared/                  the scroll-in reveal, and the head tags
public/                      icons, robots.txt, sitemap.xml, the emblem, the profile PDF
tools/cloudflare.deployment.mjs  build → restructure → deploy
tools/icons.mjs              every icon, rendered from the college emblem
```

## Day to day

```sh
npm ci
npm start          # http://localhost:4200, with HMR
npm test           # vitest
npm run build      # production build for Node → dist/katrisarai-site
npm run serve:ssr  # build, then serve it with Node — no Cloudflare involved
```

| Script             | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `npm start`        | dev server                                                         |
| `npm test`         | the specs                                                          |
| `npm run build`    | production build for Node                                          |
| `npm run build:cf` | build for Cloudflare and restructure the output, without deploying |
| `npm run preview`  | `build:cf`, then run the real Worker locally with `wrangler`       |
| `npm run deploy`   | build, restructure, `wrangler pages deploy`                        |
| `npm run icons`    | re-render every icon from `public/assets/college-mark.png`         |
| `npm run format`   | prettier                                                           |

`npm run preview` is the one worth knowing: it runs `src/server.cloudflare.ts`
in the same runtime Cloudflare does, with the same asset layer, so the edge
cache and the 404 behave exactly as they will in production.

## Both languages

Hindi is the default and the only thing the server renders. English is a signal
flip in the browser, remembered in `localStorage`.

Every string the site says lives in `src/app/content/` as a `Text` — a `{ hi,
en }` pair — so the compiler is what stops a sentence being added in one
language only:

```ts
lead: text(
  'छह विषय। जीवन भर सीखने की मजबूत नींव।',
  'Six subjects. A foundation for a lifetime of learning.',
),
```

Templates resolve one with `t()`, which reads the language signal, so switching
language re-renders exactly the views that displayed text:

```html
<h2>{{ t(academics.title) }}</h2>
```

**To change a piece of copy**, edit the pair in `src/app/content/`. Nothing else
needs to move. `content.spec.ts` will fail if one side is left empty, if the
Hindi side is not in Devanagari, or if English is left in the Hindi slot.

Three further things follow from the language being a signal rather than a URL,
and they are the trade this design makes:

- `<html lang>` is written by `Translator`, and `_devanagari.scss` hangs the
  whole Devanagari type scale off it — the two scripts do not share a
  comfortable size or line height.
- A crawler sees Hindi, because that is what the server renders. There is no
  `hreflang` pair, because there is no second URL to point one at. Giving
  English its own URLs would be a change to the route table; see
  `src/app/shared/seo.ts`.
- A visitor who chose English sees Hindi for one frame on a cold load. The
  alternative — keying the render on a cookie — would double the edge cache and
  put a `Set-Cookie` on documents the Worker then refuses to store. See
  `Translator.start()`.

## What this site deliberately does not claim

Almost every fact here is transcribed from one PDF supplied by the college,
shipped at `public/college-profile.pdf` and linked from the footer. Where the
profile is silent, so is the site:

- No pass rates, placement figures or rankings.
- No library, laboratory or hostel — the campus amenities are the four the
  profile records.
- No teacher's email, photograph, qualification or room. Names and departments
  are what the profile gives.
- No admission dates, eligibility or forms. All of that is the university's,
  changes every session, and every page that touches it links to `ppup.ac.in`
  rather than answering.

The banner photograph is ancient Nalanda, not this campus, and the footer says
so in both languages.

## Deploying

```sh
npm run deploy
```

This uploads to the Cloudflare Pages project named in `wrangler.jsonc`, which is
**`katrisarai-website`** — the Angular project is `katrisarai-site`, and the two
are deliberately different things. `wrangler pages project list` is the
authority on what exists; point `wrangler.jsonc` at a name that does not, and
the deploy either fails with project-not-found or quietly creates a second
project that no domain points at.

### Building on Cloudflare instead

| Field                  | Value                                           |
| ---------------------- | ----------------------------------------------- |
| Framework preset       | None                                            |
| Build command          | `npm run build:cf`                              |
| Build output directory | `dist/katrisarai-site-cloudflare`               |
| Root directory         | _leave empty_ — the project is at the repo root |

### Before the first real deploy

The domain is a **placeholder**: `https://gdckatrisarai.ac.in`. It is baked into
the canonical URL, the `og:` tags, the sitemap, robots.txt and the JSON-LD. When
the college has a real one, change it in four places:

1. `SITE.origin` in `src/app/content/site.content.ts`
2. `public/sitemap.xml`
3. `public/robots.txt`
4. `security.allowedHosts` in the `cloudflare` configuration in `angular.json`

`sitemap.spec.ts` fails until 1, 2 and 3 agree, so only the fourth can be
forgotten quietly — and forgetting it means Angular refuses every request to the
new hostname.

## Checking the edge cache

Every HTML response says how it was produced:

```sh
curl -sI https://gdckatrisarai.ac.in/ | grep -i x-edge-cache
```

`HIT` means the edge answered without rendering, `MISS` means it rendered and
kept the result, `BYPASS` means it rendered something it will not keep (the 404
page, most often). A page that never reports `HIT` on a second request is the
symptom to chase — see `EdgeCacheState` in `src/edge/cache.ts`.
