// JWT utilities using jose library (optimized for Workers)

import { SignJWT, jwtVerify } from 'jose';

// JWT secret - TODO: move to Wrangler secrets for production
// For now using a generated secret, will be replaced with env var later
const JWT_SECRET = 'vapeindex-jwt-secret-f4c9a2b8e1d7c3f5a9e2b6d8f1c4a7e3b9d2';

export interface JWTPayload {
  userId: number;
  email: string;
  username: string;
}

/**
 * Generate a JWT token
 */
export async function generateToken(payload: JWTPayload, expiresIn: string = '7d'): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

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
