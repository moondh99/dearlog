import type { UserRole } from './types';

export function normalizeUserRole(role: UserRole | 'family' | null): UserRole | null {
  if (role === 'family') return 'guardian';
  return role;
}

export function isGuardianRole(role: UserRole | 'family' | null): boolean {
  return normalizeUserRole(role) === 'guardian';
}
