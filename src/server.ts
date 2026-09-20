import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

/**
 * The Node entry point, and the **default** one — plain `ng build` and
 * `ng serve` use this file. The Cloudflare Workers equivalent is
 * `server.cloudflare.ts`, reached through the `cloudflare` build configuration.
 *
 * # Why both exist
 *
 * Cloudflare is where this site is deployed, and a Worker cannot run this file:
 * no `http.Server`, no filesystem, no `process.env`. But a site you can only
 * run on someone else's edge is a site you cannot debug when that edge is
 * having a bad day — or when whoever is maintaining it has no Cloudflare
 * account — and `wrangler dev` needs the network to start.
 *
 * So Node stays the default. `npm run serve:ssr` serves the real production
 * build with no Cloudflare account involved, which is the fastest way to find
 * out whether a bug is in the application or in the deployment.
 *
 * # What it deliberately does not do
 *
 * None of the edge caching. That belongs to the Worker, where there is a shared
 * cache to put things in; here, one process serves one machine and a cache in
 * front of it would only hide the render being slow.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * `ALLOWED_HOSTS` matters as soon as this is reachable at anything other than
 * localhost: Angular refuses a request whose Host header it does not recognise,
 * and the build bakes in only what `security.allowedHosts` names. Left unset
 * that is exactly the right set for a developer's machine, which is what this
 * server is usually for.
 */
const angularApp = new AngularNodeAppEngine({
  allowedHosts: (process.env['ALLOWED_HOSTS'] ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
});

/**
 * Static files from the browser build.
 *
 * `index: false` so a request for `/` is rendered rather than answered with a
 * bare shell, and `redirect: false` so a directory-shaped URL is not bounced
 * before the router has seen it.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/** Everything else is Angular. */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/** Used by the Angular CLI's dev server and by the build's route extractor. */
export const reqHandler = createNodeRequestHandler(app);
