import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * How each route is produced on the server.
 *
 * Everything is `Server`: the page is rendered per request and the Worker's
 * edge cache holds the result, rather than the build baking HTML out. That is
 * a deliberate choice for a site whose content is, today, entirely static and
 * could as easily be prerendered —
 *
 *   - Prerendering moves the render to build time and serves files. It is
 *     faster and cheaper, and it is the right answer the moment the content
 *     stops changing for good.
 *   - Server rendering keeps every page a render, which means the day a page
 *     needs something the build cannot know — an admission notice, a list of
 *     results, a holiday calendar the office edits — nothing about the
 *     deployment changes. With the edge cache in front of it, the cost of that
 *     option is one render per page per deployment per edge location.
 *
 * For this site the second is worth more: a college site that cannot publish a
 * notice without a developer is a college site that stops being updated, and
 * the notices are the one thing here certain to arrive eventually.
 *
 * The catch-all's `status` is what makes a wrong address a real 404 rather
 * than a 200 with an apology on it. The edge cache stores only 200s, so these
 * never accumulate there either.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'academics', renderMode: RenderMode.Server },
  { path: 'faculty', renderMode: RenderMode.Server },
  { path: 'students', renderMode: RenderMode.Server },
  { path: 'contact', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
