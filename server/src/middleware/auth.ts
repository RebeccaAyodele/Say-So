import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { config } from '../config.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

interface SupabaseJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface JwksResponse {
  keys?: SupabaseJwk[];
}

const jwksCache = new Map<string, { expiresAt: number; keys: SupabaseJwk[] }>();
const JWKS_CACHE_MS = 10 * 60 * 1000;

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header with Bearer token',
      },
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  // Support simplified test tokens in non-production environments
  if (config.NODE_ENV !== 'production' && (token.startsWith('test_user_') || token === 'mock_token')) {
    req.userId = token.startsWith('test_user_') ? token : 'test_user_default';
    req.userEmail = `${req.userId}@example.com`;
    next();
    return;
  }

  // Supabase access tokens are signed JWTs. Always verify the signature and
  // the claims; decoding alone would allow an attacker to choose any user id.
  try {
    const issuer = config.SUPABASE_URL ? `${config.SUPABASE_URL.replace(/\/$/, '')}/auth/v1` : undefined;
    if (!issuer) throw new Error('Supabase issuer is not configured');

    const decodedHeader = jwt.decode(token, { complete: true }) as { header?: { alg?: string; kid?: string } } | null;
    const algorithm = decodedHeader?.header?.alg;
    let decoded: { sub?: string; email?: string };

    if (algorithm === 'RS256' || algorithm === 'ES256') {
      decoded = await verifyWithSupabaseJwks(token, issuer, algorithm, decodedHeader?.header?.kid);
    } else if (algorithm === 'HS256' && config.SUPABASE_JWT_SECRET) {
      decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET, {
        issuer,
        audience: 'authenticated',
        algorithms: ['HS256'],
      }) as { sub?: string; email?: string };
    } else {
      throw new Error('Unsupported Supabase token signing algorithm');
    }

      if (!decoded.sub) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid token payload: missing sub claim',
          },
        });
        return;
      }
      req.userId = decoded.sub;
      req.userEmail = decoded.email;
      next();
      return;
  } catch (err) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        details: err instanceof Error ? err.message : undefined,
      },
    });
  }
}

async function verifyWithSupabaseJwks(
  token: string,
  issuer: string,
  algorithm: 'RS256' | 'ES256',
  keyId?: string,
): Promise<{ sub?: string; email?: string }> {
  const jwksUrl = `${issuer}/.well-known/jwks.json`;
  let keys = await getJwks(jwksUrl);
  let jwk = keys.find((key) => key.kid === keyId && (!key.alg || key.alg === algorithm));

  // A newly rotated key may not be in the short-lived cache yet.
  if (!jwk) {
    jwksCache.delete(jwksUrl);
    keys = await getJwks(jwksUrl);
    jwk = keys.find((key) => key.kid === keyId && (!key.alg || key.alg === algorithm));
  }

  if (!jwk || !keyId) throw new Error('Supabase signing key not found');
  const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
  return jwt.verify(token, publicKey, {
    issuer,
    audience: 'authenticated',
    algorithms: [algorithm],
  }) as { sub?: string; email?: string };
}

async function getJwks(url: string): Promise<SupabaseJwk[]> {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Unable to load Supabase signing keys (${response.status})`);
  const body = (await response.json()) as JwksResponse;
  const keys = body.keys ?? [];
  jwksCache.set(url, { keys, expiresAt: Date.now() + JWKS_CACHE_MS });
  return keys;
}
