import { jwtVerify } from 'jose';

export interface JWTPayload {
  userId: string | number;
  email?: string;
  username?: string;
}

function getSecretBytes(secret: string) {
  if (!secret) {
    throw new Error('JWT secret not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const secretBytes = getSecretBytes(secret);
    const { payload } = await jwtVerify(token, secretBytes);

    return {
      userId: payload.userId as string | number,
      email: payload.email as string | undefined,
      username: payload.username as string | undefined,
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}
