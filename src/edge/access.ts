/**
 * Who is allowed to write to this site.
 *
 * Cloudflare Access sits in front of `/admin` and the write endpoints. It does
 * the login — Google, a one-time email code, whatever the Zero Trust policy
 * says — and hands the request on with a signed assertion of who the visitor
 * is. This file is the part that checks the signature.
 *
 * # Why not just read `Cf-Access-Authenticated-User-Email`
 *
 * Because a header is a string anyone can send. Cloudflare sets that header on
 * requests that came through Access, and it is genuinely trustworthy *if* the
 * request reached the Worker through Access — but a Pages Worker is also
 * reachable at its `*.pages.dev` hostname, and a Zero Trust policy scoped to a
 * path or a custom domain does not necessarily cover it. Trusting the header
 * alone means the whole admin API is open to anyone who types the right header
 * name, and it would look completely fine in testing.
 *
 * So: verify the JWT. Access signs it with the team's own key, publishes the
 * public half, and the signature is the thing that cannot be forged.
 *
 * # What is checked
 *
 * Signature, issuer, audience, expiry and not-before. The audience is the
 * Access application's tag: without that check, a token minted for *any* app
 * in the same Zero Trust team is accepted here, which is how one team's
 * unrelated internal tool becomes a login for the college's notice board.
 */

/** A verified identity. Nothing here is taken from the request's headers. */
export interface AccessIdentity {
  readonly email: string;
  /** The Access user id, kept for the audit columns. */
  readonly subject: string;
}

export interface AccessConfig {
  /** e.g. `sorafabriclabs.cloudflareaccess.com`. */
  readonly teamDomain: string;
  /** The Access application's Audience (AUD) tag. */
  readonly audience: string;
}

/** A JSON Web Key, as Access publishes them. */
interface Jwk {
  kid: string;
  kty: string;
  alg: string;
  n: string;
  e: string;
}

/**
 * The team's public keys, fetched once per isolate and kept for an hour.
 *
 * Access rotates these, so they cannot be baked into the build; fetching them
 * on every request would put a round trip in front of every admin action. An
 * hour is well inside the rotation window, and a key that has genuinely gone
 * away produces a verification failure that the caller turns into a 401 — an
 * admin logging in again, not an outage.
 */
let keyCache: { keys: Promise<Jwk[]>; fetchedAt: number } | undefined;
const KEY_TTL_MS = 3_600_000;

function publicKeys(teamDomain: string): Promise<Jwk[]> {
  const now = Date.now();
  if (!keyCache || now - keyCache.fetchedAt > KEY_TTL_MS) {
    keyCache = {
      fetchedAt: now,
      keys: fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
        .then((response) => {
          if (!response.ok) throw new Error(`Access certs: ${response.status}`);
          return response.json() as Promise<{ keys: Jwk[] }>;
        })
        .then((body) => body.keys ?? [])
        .catch((error) => {
          // Do not cache a failure for an hour.
          keyCache = undefined;
          throw error;
        }),
    };
  }
  return keyCache.keys;
}

/** Base64url → bytes. */
function decode(segment: string): Uint8Array {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decode(segment)));
}

/**
 * Verifies the Access assertion on a request and returns who it is, or `null`.
 *
 * `null` rather than a thrown error for an unauthenticated request, because
 * "nobody is signed in" is an ordinary answer the caller turns into a 401. A
 * *broken* configuration — no team domain, unreachable certs — does throw,
 * because answering 401 to that would present a misconfigured deployment as a
 * login problem and send whoever is on call to the wrong place entirely.
 */
export async function verifyAccess(
  request: Request,
  config: AccessConfig,
): Promise<AccessIdentity | null> {
  if (!config.teamDomain || !config.audience) {
    throw new Error('Cloudflare Access is not configured: set ACCESS_TEAM_DOMAIN and ACCESS_AUD.');
  }

  // Access puts the token in a header on API-style requests and in a cookie on
  // browser navigations. The admin page is the second and its fetches are the
  // first, so both have to be read.
  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ?? cookie(request, 'CF_Authorization');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJson(headerSegment);
    payload = decodeJson(payloadSegment);
  } catch {
    return null;
  }

  if (header['alg'] !== 'RS256') return null;

  const keys = await publicKeys(config.teamDomain);
  const jwk = keys.find((key) => key.kid === header['kid']);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signed = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decode(signatureSegment) as BufferSource,
    signed as BufferSource,
  );
  if (!valid) return null;

  if (!claimsAreValid(payload, config)) return null;

  const email = typeof payload['email'] === 'string' ? payload['email'] : '';
  const subject = typeof payload['sub'] === 'string' ? payload['sub'] : '';
  if (!email) return null;

  return { email, subject };
}

/**
 * Issuer, audience and the two time bounds.
 *
 * Exported so the spec can reach it: the signature check needs a real key pair
 * and a real team, and these are the rules that are easy to get wrong and
 * cheap to test.
 */
export function claimsAreValid(
  payload: Record<string, unknown>,
  config: AccessConfig,
  now: number = Date.now(),
): boolean {
  if (payload['iss'] !== `https://${config.teamDomain}`) return false;

  // `aud` is an array in Access's tokens, but the JWT spec allows a bare
  // string and a token that arrives in that shape should not silently pass.
  const aud = payload['aud'];
  const audiences = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
  if (!audiences.includes(config.audience)) return false;

  const seconds = Math.floor(now / 1000);
  const exp = payload['exp'];
  const nbf = payload['nbf'];
  if (typeof exp !== 'number' || seconds >= exp) return false;
  if (typeof nbf === 'number' && seconds < nbf) return false;

  return true;
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}
