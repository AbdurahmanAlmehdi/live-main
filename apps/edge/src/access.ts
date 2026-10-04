import { json } from '@livemain/core';
import type { Env } from './env.js';

/**
 * Cloudflare Access in front of the deployed Worker. Access blocks unauthenticated requests at
 * the edge; the Worker also verifies the Access JWT on every request it handles, so a route
 * that bypasses Access (or a deploy before Access is configured) fails closed.
 *
 * Enabled by LIVEMAIN_REQUIRE_ACCESS; configured by ACCESS_TEAM_DOMAIN (e.g.
 * `livemain.cloudflareaccess.com`) and ACCESS_AUD (the application's audience tag).
 */
export async function requireAccess(request: Request, env: Env): Promise<Response | { email: string | null }> {
  if (!env.LIVEMAIN_REQUIRE_ACCESS) return { email: null };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return json({ error: 'access-not-configured', message: 'This deployment requires Cloudflare Access, which is not configured yet.' }, 503);
  }
  const token = request.headers.get('cf-access-jwt-assertion') ?? cookie(request, 'CF_Authorization');
  if (!token) return json({ error: 'unauthenticated', message: 'Sign in through Cloudflare Access.' }, 401);
  try {
    const claims = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    return { email: claims.email ?? null };
  } catch (err) {
    return json({ error: 'unauthenticated', message: err instanceof Error ? err.message : 'invalid Access token' }, 401);
  }
}

export interface AccessClaims {
  aud: string | string[];
  iss: string;
  exp: number;
  email?: string;
  sub: string;
}

let jwks: { team: string; keys: (JsonWebKey & { kid?: string })[]; at: number } | null = null;

async function signingKey(team: string, kid: string, fetchImpl: typeof fetch): Promise<CryptoKey> {
  const fresh = jwks && jwks.team === team && Date.now() - jwks.at < 3600_000 && jwks.keys.some((k) => k.kid === kid);
  if (!fresh) {
    const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`Access certs: ${res.status}`);
    jwks = { team, keys: ((await res.json()) as { keys: (JsonWebKey & { kid?: string })[] }).keys, at: Date.now() };
  }
  const jwk = jwks!.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error('unknown Access signing key');
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

/** Verifies an Access JWT (RS256, signed by the team's keys) and returns its claims. */
export async function verifyAccessJwt(token: string, team: string, aud: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<AccessClaims> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed Access token');
  const header = JSON.parse(text(h)) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unexpected Access token algorithm');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await signingKey(team, header.kid, fetchImpl), bytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('bad Access token signature');
  const claims = JSON.parse(text(p)) as AccessClaims;
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(aud)) throw new Error('Access token is for another application');
  if (claims.iss !== `https://${team}`) throw new Error('Access token from another team');
  if (claims.exp * 1000 <= now) throw new Error('Access token expired');
  return claims;
}

function bytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function text(b64url: string): string {
  return new TextDecoder().decode(bytes(b64url));
}

function cookie(request: Request, name: string): string | null {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(request.headers.get('cookie') ?? '');
  return m ? decodeURIComponent(m[1]!) : null;
}
