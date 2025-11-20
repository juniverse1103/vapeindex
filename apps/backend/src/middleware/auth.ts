// Auth middleware - protect routes requiring authentication

import { Context, Next } from 'hono';
import { verifyToken, extractToken } from '../lib/auth/jwt';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

/**
 * Auth middleware - verifies JWT token and attaches user to context
 */
export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ error: 'No authentication token provided' }, 401);
    }

    // Verify JWT
    const payload = await verifyToken(token);

    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Attach user to context for use in routes
    c.set('user', payload);

    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

/**
 * Optional auth middleware - doesn't fail if no token, just attaches user if available
 */
export async function optionalAuthMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader);

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        c.set('user', payload);
      }
    }

    await next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue even if auth fails
    await next();
  }
}
