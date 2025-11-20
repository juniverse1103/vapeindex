// Auth API client for frontend

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:51728';

export interface User {
  id: number;
  email: string;
  username: string;
  karma?: number;
  created_at?: number;
}

export interface AuthResponse {
  token: string;
  sessionId: string;
  user: User;
}

export interface ApiError {
  error: string;
}

/**
 * Register a new user
 */
export async function register(email: string, username: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }

    // Store token and session
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('session_id', data.sessionId);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return { success: true, data };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  try {
    const sessionId = typeof localStorage !== 'undefined' ? localStorage.getItem('session_id') : null;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (sessionId && token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId,
        },
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('session_id');
      localStorage.removeItem('user');
    }
  }
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Verification failed' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Verify email error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Request password reset
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Forgot password error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Password reset failed' };
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;

    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Token expired or invalid
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('session_id');
        localStorage.removeItem('user');
      }
      return { success: false, error: data.error || 'Not authenticated' };
    }

    // Update stored user
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Get current user error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

/**
 * Get stored user from localStorage
 */
export function getStoredUser(): User | null {
  if (typeof localStorage === 'undefined') return null;

  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}
