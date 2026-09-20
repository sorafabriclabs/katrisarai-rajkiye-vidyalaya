import { describe, expect, it } from 'vitest';

import { claimsAreValid } from './access';

const config = { teamDomain: 'example.cloudflareaccess.com', audience: 'aud-tag-1' };
const now = Date.UTC(2026, 8, 20, 12, 0, 0);
const seconds = Math.floor(now / 1000);

const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://example.cloudflareaccess.com',
  aud: ['aud-tag-1'],
  exp: seconds + 3600,
  nbf: seconds - 60,
  email: 'principal@example.ac.in',
  sub: 'user-1',
  ...over,
});

/**
 * The claim checks are what stand between the notice board and anyone who can
 * obtain *a* Cloudflare Access token — which, for a team with more than one
 * application, is a much larger set of people than those allowed to post
 * notices. The signature check needs a real key pair and a real team; these
 * are the rules that are easy to get wrong and cheap to test.
 */
describe('claimsAreValid', () => {
  it('accepts a well-formed token', () => {
    expect(claimsAreValid(claims(), config, now)).toBe(true);
  });

  it('rejects a token minted for another application in the same team', () => {
    // The whole reason the audience is checked. Without it, any other Zero
    // Trust app in the org becomes a login for this one.
    expect(claimsAreValid(claims({ aud: ['some-other-app'] }), config, now)).toBe(false);
  });

  it('accepts the audience as a bare string as well as an array', () => {
    expect(claimsAreValid(claims({ aud: 'aud-tag-1' }), config, now)).toBe(true);
  });

  it('rejects a token from another team', () => {
    expect(
      claimsAreValid(claims({ iss: 'https://attacker.cloudflareaccess.com' }), config, now),
    ).toBe(false);
  });

  it('rejects an expired token, at the exact second it expires', () => {
    expect(claimsAreValid(claims({ exp: seconds + 1 }), config, now)).toBe(true);
    expect(claimsAreValid(claims({ exp: seconds }), config, now)).toBe(false);
    expect(claimsAreValid(claims({ exp: seconds - 1 }), config, now)).toBe(false);
  });

  it('rejects a token that is not valid yet', () => {
    expect(claimsAreValid(claims({ nbf: seconds + 1 }), config, now)).toBe(false);
    expect(claimsAreValid(claims({ nbf: seconds }), config, now)).toBe(true);
  });

  it('rejects a token with no expiry rather than treating it as eternal', () => {
    expect(claimsAreValid(claims({ exp: undefined }), config, now)).toBe(false);
    expect(claimsAreValid(claims({ exp: 'later' }), config, now)).toBe(false);
  });

  it('tolerates a missing nbf, which is optional', () => {
    expect(claimsAreValid(claims({ nbf: undefined }), config, now)).toBe(true);
  });

  it('rejects an empty or missing audience claim', () => {
    expect(claimsAreValid(claims({ aud: [] }), config, now)).toBe(false);
    expect(claimsAreValid(claims({ aud: undefined }), config, now)).toBe(false);
  });
});
