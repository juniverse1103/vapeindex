// Auth store using nanostores for reactive state management

import { atom } from 'nanostores';
import type { User } from './auth';
import { getStoredUser, isAuthenticated } from './auth';

// Auth state
export const $user = atom<User | null>(null);
export const $isAuthenticated = atom<boolean>(false);

// Initialize auth state from localStorage
if (typeof window !== 'undefined') {
  $user.set(getStoredUser());
  $isAuthenticated.set(isAuthenticated());
}

// Update auth state
export function setAuthState(user: User | null) {
  $user.set(user);
  $isAuthenticated.set(!!user);
}

// Clear auth state
export function clearAuthState() {
  $user.set(null);
  $isAuthenticated.set(false);
}
