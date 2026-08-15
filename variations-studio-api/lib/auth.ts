import { jwtVerify } from 'jose';

export type AccessUser = {
  userId: number;
};

export type AuthFailure = {
  error: string;
  status: 401;
};

function getSigningKey() {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('SECRET_KEY is not configured');
  }
  return new TextEncoder().encode(secret);
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export async function requireAccessUser(
  request: Request
): Promise<AccessUser | AuthFailure> {
  const token = bearerToken(request);
  if (!token) {
    return { error: 'Authentication credentials were not provided.', status: 401 };
  }

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ['HS256'],
    });

    if (payload.token_type && payload.token_type !== 'access') {
      return { error: 'Given token not valid for any token type', status: 401 };
    }

    const rawId = payload.user_id;
    const userId = typeof rawId === 'number' ? rawId : Number(rawId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return { error: 'Invalid token payload', status: 401 };
    }

    return { userId };
  } catch {
    return { error: 'Invalid or expired token.', status: 401 };
  }
}

export function isAuthFailure(
  value: AccessUser | AuthFailure
): value is AuthFailure {
  return 'status' in value;
}
