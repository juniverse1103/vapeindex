// Verification and reset token utilities

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return crypto.randomUUID();
}

/**
 * Generate a verification token with expiry
 */
export function generateVerificationToken(): {
  token: string;
  expiresAt: number;
} {
  return {
    token: generateToken(),
    expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  };
}

/**
 * Generate a password reset token with expiry
 */
export function generatePasswordResetToken(): {
  token: string;
  expiresAt: number;
} {
  return {
    token: generateToken(),
    expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiresAt: number): boolean {
  return Math.floor(Date.now() / 1000) > expiresAt;
}
