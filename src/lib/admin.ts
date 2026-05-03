// Check if a user ID is in the admin list.
// ADMIN_USER_IDS is a comma-separated list of UUIDs in .env.
export function isAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = (import.meta.env.VITE_ADMIN_USER_IDS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}
