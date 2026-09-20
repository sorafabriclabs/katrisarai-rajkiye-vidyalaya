# Government Degree College, Katrisarai

राजकीय डिग्री महाविद्यालय, कतरीसराय, नालन्दा — a constituent unit of Patliputra
University, Patna. Angular 22, server-rendered, bilingual Hindi/English,
deployed to Cloudflare Pages with the render shared between visitors at the
edge.

Six public pages, an admin area and a 404. Most of the site is static — the
route table in `src/app/app.routes.ts` and the copy in `src/app/content/` — and
the notice board is not: it lives in D1, with uploaded files in R2 and
Cloudflare Access in front of the page that writes to it.

```
src/
  index.html                 the document: fonts, icons, structured data
  main.ts / main.server.ts   browser and server bootstrap
  server.ts                  Node entry — the default, and what `ng serve` uses
  server.cloudflare.ts       Cloudflare Worker entry — assets, edge cache, render
  edge/cache.ts              the caching rules, with no Cloudflare in them
  edge/access.ts             Cloudflare Access: verifies the JWT, not a header
  edge/api.ts                the notice API and /media
  edge/notices.ts            the D1 queries, and the content stamp
  edge/media.ts              R2: what may be uploaded, and how it is served
  model/                     shapes shared by the Worker and the app
  styles.scss + styles/      one global stylesheet, one partial per region
  app/
    app.ts                   the shell: header, page, footer
    app.routes.ts            every page, its title and its description
    app.routes.server.ts     how each is rendered, and the 404's status
    content/                 all the copy, as data, in both languages
    i18n/language.ts         the language signal, and the `Text` pair
    notices/                 the notice store, and the browser-side resize
    layout/                  header, footer, page hero, student desk
    pages/                   home, notices, academics, faculty, students,
                             contact, admin, not-found
    shared/                  the scroll-in reveal, and the head tags
migrations/                  the D1 schema
public/                      icons, robots.txt, sitemap.xml, the emblem, the profile PDF
tools/cloudflare.deployment.mjs  build → restructure → deploy
tools/icons.mjs              icons: the seal for large, a drawn mark for the tab
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
| `npm run icons`    | re-render every icon from the two sources in `public/assets/`      |
| `npm run format`   | prettier                                                           |

`npm run preview` is the one worth knowing: it runs `src/server.cloudflare.ts`
in the same runtime Cloudflare does, with the same asset layer, so the edge
cache and the 404 behave exactly as they will in production.

## The notice board

The office publishes notices at `/admin`. They appear on `/notices` and the
three most recent appear on the home page, with a **नया / New** mark for
sixty days (`NEW_FOR_DAYS` in `src/model/notice.ts`).

### How a published notice reaches the page

This is the part worth understanding, because it looks like magic and breaks
like a cache.

Every rendered page is held at the edge for a day, keyed by the deployment id.
That is right for content that only changes on deploy and wrong for a notice
board, so the key carries a second stamp — a number in the `settings` table
that every write bumps. A publish therefore invalidates the edge by _not
matching_ any key that exists: no purge call, no API token, no window in which
the purge has not run yet.

The stamp is read before the cache lookup, so it is memoised for fifteen
seconds per isolate (`contentStamp` in `src/edge/notices.ts`). **A published
notice is live within about fifteen seconds**, not instantly and not in a day.
The admin page says so after every save.

### First-time setup

```sh
# 1. The database
npx wrangler d1 create katrisarai-notices
#    → copy the database_id into wrangler.jsonc
npx wrangler d1 migrations apply katrisarai-notices --remote

# 2. The bucket for uploads
npx wrangler r2 bucket create katrisarai-media

# 3. Locally
npx wrangler d1 migrations apply katrisarai-notices --local
npm run preview
```

### Cloudflare Access

Access is what makes the admin area an admin area. There is **no password in
this codebase** and no session handling: Cloudflare does the login, and the
Worker verifies the signed assertion on every write.

In the dashboard, under Zero Trust → Access → Applications, add a self-hosted
application covering `<your-domain>/admin*` and `<your-domain>/api/*`, with a
policy allowing the staff who may publish. Then put the team domain and the
application's **Audience (AUD) tag** into `wrangler.jsonc`:

```jsonc
"vars": {
  "ACCESS_TEAM_DOMAIN": "yourteam.cloudflareaccess.com",
  "ACCESS_AUD": "<the AUD tag from the Access application>"
}
```

The AUD check is not optional. Without it, a token minted for _any_ other
application in the same Zero Trust team is accepted here — see the comment at
the top of `src/edge/access.ts`. Neither value is a secret.

Until both are set, every write answers **500** with a message saying so,
rather than 401 — a misconfigured deployment should not look like a login
problem.

### What the office can and cannot do

Publish, edit, withdraw a notice; attach a PDF or an image; replace the banner
photograph. Hindi is required on every notice and English is optional — where
it is blank, English readers see the Hindi, which is better than a blank page.
Uploads are capped at 10MB, limited to JPEG, PNG, WebP and PDF (**not** SVG,
which is a script as much as an image), and stored under a hash of their own
bytes so `/media/<key>` is immutable and cacheable for a year. Images are
resized in the browser before upload, because a Worker cannot resize them and
a 5MB photograph from a phone would otherwise be served to every visitor.

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
**`katrisarai-rajkiye-vidyalaya-site`** — the Angular project is
`katrisarai-site`, and the two are deliberately different things.
`wrangler pages project list` is the authority on what exists; point
`wrangler.jsonc` at a name that does not, and the deploy either fails with
project-not-found or quietly creates a second project that no domain points at.

The project name is also the hostname: Pages serves it at
`katrisarai-rajkiye-vidyalaya-site.pages.dev`, with previews at
`<hash>.katrisarai-rajkiye-vidyalaya-site.pages.dev`. Both are in
`allowedHosts`, which is why the wildcard is there — Angular refuses a request
whose `Host` it does not recognise, so a preview deployment on an unlisted
hostname answers nothing at all.

### Building on Cloudflare instead

| Field                  | Value                                           |
| ---------------------- | ----------------------------------------------- |
| Framework preset       | None                                            |
| Build command          | `npm run build:cf`                              |
| Build output directory | `dist/katrisarai-site-cloudflare`               |
| Root directory         | _leave empty_ — the project is at the repo root |

### Before the first real deploy

The domain is **not registered yet**: `https://rdmkatrisarai.ac.in` — RDM for
राजकीय डिग्री महाविद्यालय. It is baked into the canonical URL, the `og:` tags,
the sitemap, robots.txt and the JSON-LD. To change it, five places:

1. `SITE.origin` in `src/app/content/site.content.ts`
2. `public/sitemap.xml`
3. `public/robots.txt`
4. `src/index.html` — `og:image`, and the JSON-LD `url` and `logo`
5. `security.allowedHosts` in the `cloudflare` configuration in `angular.json`

`sitemap.spec.ts` fails until 1–4 agree, so only the fifth can be forgotten
quietly — and forgetting it means Angular refuses every request to the new
hostname.

Number 4 is the one that used to be missed: nothing imports `index.html`, so a
stale `og:image` is invisible until somebody shares a link and gets a broken
preview, and a stale JSON-LD `url` tells a search engine the college lives
somewhere it does not. It is covered by a spec now.

## Checking the edge cache

Every HTML response says how it was produced:

```sh
curl -sI https://rdmkatrisarai.ac.in/ | grep -i x-edge-cache
```

`HIT` means the edge answered without rendering, `MISS` means it rendered and
kept the result, `BYPASS` means it rendered something it will not keep (the 404
page, most often). A page that never reports `HIT` on a second request is the
symptom to chase — see `EdgeCacheState` in `src/edge/cache.ts`.
