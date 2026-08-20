import { SignJWT } from 'jose';

// Mirrors the payload rest_framework_simplejwt puts in an access token, so the
// tests exercise lib/auth against the shape Django actually issues.

const ACCESS_LIFETIME_SECONDS = 5 * 60;

function signingKey(secret?: string): Uint8Array {
  const value = secret ?? process.env.SECRET_KEY;
  if (!value) {
    throw new Error(
      'SECRET_KEY is not set. Run these tests inside the variations-studio-api container.'
    );
  }
  return new TextEncoder().encode(value);
}

type TokenOptions = {
  tokenType?: string;
  expiresInSeconds?: number;
  secret?: string;
};

export async function signToken(
  userId: number,
  options: TokenOptions = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const lifetime = options.expiresInSeconds ?? ACCESS_LIFETIME_SECONDS;

  return new SignJWT({
    token_type: options.tokenType ?? 'access',
    user_id: userId,
    jti: Math.random().toString(16).slice(2),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + lifetime)
    .sign(signingKey(options.secret));
}

export function accessToken(userId: number): Promise<string> {
  return signToken(userId);
}

export function expiredAccessToken(userId: number): Promise<string> {
  return signToken(userId, { expiresInSeconds: -60 });
}

export function refreshToken(userId: number): Promise<string> {
  return signToken(userId, { tokenType: 'refresh' });
}

export function foreignlySignedToken(userId: number): Promise<string> {
  return signToken(userId, { secret: 'not-the-django-secret-key' });
}
