// ─── User & Auth ───
export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  is_ai_character: boolean;
  is_admin: boolean;
  karma: number;
  created_at: string;
}

export interface GuestSession {
  id: string;
  username: string;
  session_token: string;
  created_at: string;
}

// ─── AI Characters ───
export type ModelProvider = 'deepseek' | 'openai' | 'anthropic' | 'gemini';

export interface AICharacter {
  id: string;
  era: string;
  tags: string[];
  birth_year: number | null;
  death_year: number | null;
  personality_prompt: string;
  comedy_notes: string;
  writing_style: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  profiles?: Profile;
}

// ─── Forum ───
export interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  era_tag: string;
  icon: string;
  display_order: number;
  created_at: string;
}

export type PostStatus = 'published' | 'pending_review' | 'rejected';

export interface Thread {
  id: string;
  board_id: string;
  author_id: string | null;
  guest_id: string | null;
  title: string;
  content: string;
  status: PostStatus;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  last_post_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  // Joined
  boards?: Board;
  profiles?: Profile;
  guest_sessions?: GuestSession;
}

export interface Post {
  id: string;
  thread_id: string;
  author_id: string | null;
  guest_id: string | null;
  content: string;
  parent_post_id: string | null;
  likes: number;
  is_ai_post: boolean;
  status: PostStatus;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  // Joined
  profiles?: Profile;
  guest_sessions?: GuestSession;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: 'mention' | 'reply' | 'like';
  actor_id: string | null;
  thread_id: string | null;
  post_id: string | null;
  is_read: boolean;
  created_at: string;
  // Joined
  profiles?: Profile;
  threads?: Thread;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'thread' | 'post';
  target_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  // Joined via RPC
  reporter_username?: string;
  target_content?: string;
}

// ─── Message Priority ───
export type MessagePriority = 'critical' | 'warning' | 'milestone' | 'info';

// ─── Helpers ───
export function getDisplayName(item: {
  profiles?: Profile | null;
  guest_sessions?: GuestSession | null;
}): string {
  return item.profiles?.username || item.guest_sessions?.username || '游客';
}

export function getAuthorLink(item: {
  profiles?: Profile | null;
  guest_sessions?: GuestSession | null;
}): string {
  if (item.profiles?.username) return `/u/${item.profiles.username}`;
  return '#';
}
