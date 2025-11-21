// JWT utilities using jose library (optimized for Workers)

import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  userId: number;
  email: string;
  username: string;
}

function getSecretBytes(secret: string) {
  if (!secret) {
    throw new Error('JWT secret not configured');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate a JWT token
 */
export async function generateToken(payload: JWTPayload, secret: string, expiresIn: string = '7d'): Promise<string> {
  const secretBytes = getSecretBytes(secret);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretBytes);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const secretBytes = getSecretBytes(secret);
    const { payload } = await jwtVerify(token, secretBytes);

    return {
      userId: payload.userId as number,
      email: payload.email as string,
      username: payload.username as string,
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}
