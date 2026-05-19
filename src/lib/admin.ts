import type { Profile } from './types';

// Check if a user/profile is an administrator.
// DB-level is_admin is the primary source of truth.
// VITE_ADMIN_USER_IDS is a comma-separated list of UUIDs in .env for dual check / fallback.
export function isAdmin(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin === true) return true;

  const ids = (import.meta.env.VITE_ADMIN_USER_IDS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  return ids.includes(profile.id);
}
