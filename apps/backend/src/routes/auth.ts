// Auth routes - register, login, verify, logout, me

import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import { generateToken, verifyToken } from '../lib/auth/jwt';
import { generateVerificationToken, generatePasswordResetToken, isTokenExpired } from '../lib/auth/tokens';
import { EmailService } from '../lib/email';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// Initialize email service
const emailService = new EmailService();

/**
 * POST /api/auth/register
 * Register a new user
 */
auth.post('/register', async (c) => {
  try {
    const { email, username, password } = await c.req.json();

    // Validate input
    if (!email || !username || !password) {
      return c.json({ error: 'Email, username, and password are required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? OR username = ?'
    ).bind(email, username).first();

    if (existingUser) {
      return c.json({ error: 'Email or username already exists' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, username, password_hash, email_verified) VALUES (?, ?, ?, 0)'
    ).bind(email, username, passwordHash).run();

    const userId = result.meta.last_row_id;

    // Create default user preferences
    await c.env.DB.prepare(
      'INSERT INTO user_preferences (user_id) VALUES (?)'
    ).bind(userId).run();

    // Generate verification token
    const { token, expiresAt } = generateVerificationToken();

    // Store verification token
    await c.env.DB.prepare(
      'INSERT INTO verification_tokens (token, user_id, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(token, userId, 'email_verification', expiresAt).run();

    // Send verification email
    const baseUrl = new URL(c.req.url).origin;
    await emailService.sendVerificationEmail(email, username, token, baseUrl);

    return c.json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId,
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, password_hash, email_verified FROM users WHERE email = ?'
    ).bind(email).first() as any;

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Check if email is verified
    // TODO: Re-enable after DNS is configured
    // if (!user.email_verified) {
    //   return c.json({ error: 'Please verify your email before logging in' }, 403);
    // }

    // Generate JWT
    const token = await generateToken(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
      },
      c.env.JWT_SECRET
    );

    // Store session in KV
    const sessionId = crypto.randomUUID();
    await c.env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify({
        userId: user.id,
        email: user.email,
        username: user.username,
      }),
      { expirationTtl: 604800 } // 7 days
    );

    return c.json({
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
auth.post('/verify-email', async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: 'Token is required' }, 400);
    }

    // Find token
    const verificationToken = await c.env.DB.prepare(
      'SELECT user_id, expires_at FROM verification_tokens WHERE token = ? AND type = ?'
    ).bind(token, 'email_verification').first() as any;

    if (!verificationToken) {
      return c.json({ error: 'Invalid verification token' }, 404);
    }

    // Check if expired
    if (isTokenExpired(verificationToken.expires_at)) {
      return c.json({ error: 'Verification token has expired' }, 410);
    }

    // Mark email as verified
    await c.env.DB.prepare(
      'UPDATE users SET email_verified = 1 WHERE id = ?'
    ).bind(verificationToken.user_id).run();

    // Delete token
    await c.env.DB.prepare(
      'DELETE FROM verification_tokens WHERE token = ?'
    ).bind(token).run();

    return c.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', error);
    return c.json({ error: 'Verification failed' }, 500);
  }
});

/**
 * POST /api/auth/logout
 * Logout (invalidate session)
 */
auth.post('/logout', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID');

    if (sessionId) {
      await c.env.SESSIONS.delete(`session:${sessionId}`);
    }

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ error: 'Logout failed' }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires authentication)
 */
auth.get('/me', async (c) => {
  try {
    // Get user from context (set by auth middleware)
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    // Fetch full user details
    const fullUser = await c.env.DB.prepare(
      'SELECT id, email, username, karma, created_at FROM users WHERE id = ?'
    ).bind(user.userId).first();

    if (!fullUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: fullUser });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email is required' }, 400);
    }

    // Find user
    const user = await c.env.DB.prepare(
      'SELECT id, username FROM users WHERE email = ?'
    ).bind(email).first() as any;

    // Always return success to prevent email enumeration
    if (!user) {
      return c.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // Generate reset token
    const { token, expiresAt } = generatePasswordResetToken();

    // Store reset token
    await c.env.DB.prepare(
      'INSERT INTO verification_tokens (token, user_id, type, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(token, user.id, 'password_reset', expiresAt).run();

    // Send reset email
    const baseUrl = new URL(c.req.url).origin;
    await emailService.sendPasswordResetEmail(email, user.username, token, baseUrl);

    return c.json({ message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Request failed' }, 500);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
auth.post('/reset-password', async (c) => {
  try {
    const { token, password } = await c.req.json();

    if (!token || !password) {
      return c.json({ error: 'Token and password are required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    // Find token
    const resetToken = await c.env.DB.prepare(
      'SELECT user_id, expires_at FROM verification_tokens WHERE token = ? AND type = ?'
    ).bind(token, 'password_reset').first() as any;

    if (!resetToken) {
      return c.json({ error: 'Invalid reset token' }, 404);
    }

    // Check if expired
    if (isTokenExpired(resetToken.expires_at)) {
      return c.json({ error: 'Reset token has expired' }, 410);
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(passwordHash, resetToken.user_id).run();

    // Delete token
    await c.env.DB.prepare(
      'DELETE FROM verification_tokens WHERE token = ?'
    ).bind(token).run();

    return c.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Password reset failed' }, 500);
  }
});

export default auth;
