import { supabase } from './supabase';
import type { Board, Thread, Post, AICharacter } from './types';

// ─── Helper ───
function requireSupabase() {
  if (!supabase) throw new Error('Supabase 未配置');
  return supabase;
}

// ─── Rate Limiting ───
const lastAction: Record<string, number> = {};
function checkRateLimit(key: string, intervalMs: number): number {
  const now = Date.now();
  const elapsed = now - (lastAction[key] || 0);
  if (elapsed < intervalMs) return Math.ceil((intervalMs - elapsed) / 1000);
  lastAction[key] = now;
  return 0;
}
export function canCreateThread(isGuest: boolean): { ok: boolean; wait?: number } {
  const wait = checkRateLimit('thread', isGuest ? 5 * 60 * 1000 : 60 * 1000);
  return { ok: wait === 0, wait: wait || undefined };
}
export function canCreateReply(isGuest: boolean): { ok: boolean; wait?: number } {
  const wait = checkRateLimit('reply', isGuest ? 60 * 1000 : 6 * 1000);
  return { ok: wait === 0, wait: wait || undefined };
}

// Call the post-handler Edge Function via Supabase client (handles auth properly).
// Returns null if Edge Function is unreachable so callers fall back to RPC.
// Throws rate-limit errors to show to the user.
async function callPostHandler(payload: Record<string, unknown>) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('post-handler', {
      body: payload,
    });
    if (error) {
      console.error('[EDGE-FUNCTION-ERROR]', error);
      const msg = (error as any).message || '';
      if (msg && (msg.includes('频繁') || msg.includes('rate limit'))) {
        throw new Error(msg);
      }
      return null;
    }
    return data;
  } catch (err: unknown) {
    if ((err as Error).message?.includes('频繁')) throw err;
    console.warn('[FALLBACK] Edge Function 失败，正在回退到 RPC 模式以确保发帖成功。错误详情:', err);
    return null;
  }
}

// ─── Boards ───
export async function getBoards(): Promise<Board[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
  return data as Board[];
}

export async function getBoardBySlug(slug: string): Promise<Board | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('slug', slug)
    .single();
    
  if (error) {
    console.error(`Error fetching board ${slug}:`, error);
    return null;
  }
  return data as Board;
}

export async function getRecentThreads(limit: number = 20, offset: number = 0): Promise<Thread[]> {
  if (!supabase) return [];
  // Fetch twice as many threads, then apply weighted random ranking
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      boards (*),
      profiles (*),
      guest_sessions (*)
    `)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('pin_level', { ascending: false })
    .order('last_post_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching recent threads:', error);
    return [];
  }

  const threads = data as Thread[];
  const minuteSeed = new Date().getMinutes() + new Date().getHours() * 60;
  const now = Date.now();
  function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h); }
  function hoursAgo(d: string): number { return Math.max(0, (now - new Date(d).getTime()) / 3600000); }

  // Separate pinned from unpinned — pinned always first
  const pinned = threads.filter(t => t.pin_level > 0);
  const unpinned = threads.filter(t => t.pin_level === 0);

  const scored = unpinned.map(t => {
    const ageH = hoursAgo(t.last_post_at);
    const recency = Math.max(0, 15 - Math.floor(ageH / 40)); // 15pts now, decays by 1 every 40h, 0 after 600h
    return {
      thread: t,
      score: (t.is_featured ? 20 : 0)            // featured: +20
        + recency                                 // recency: 0-15
        + Math.min(t.reply_count, 10)             // engagement: 0-10
        + hash(t.id + minuteSeed) % 10,           // random: 0-9, changes every minute
    };
  });
  scored.sort((a, b) => b.score - a.score);

  // Pinned sorted by level, then merged with scored
  pinned.sort((a, b) => b.pin_level - a.pin_level);
  const result = [...pinned.map(t => ({ thread: t, score: 999 })), ...scored];
  return result.slice(offset, offset + limit).map(s => s.thread);
}

export async function getThreadsByBoard(boardId: string, limit: number = 20, offset: number = 0): Promise<Thread[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      boards (*),
      profiles (*),
      guest_sessions (*)
    `)
    .eq('board_id', boardId)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('pin_level', { ascending: false })
    .order('last_post_at', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) {
    console.error(`Error fetching threads for board ${boardId}:`, error);
    return [];
  }
  return data as Thread[];
}

export async function getThreadById(threadId: string): Promise<Thread | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      boards (*),
      profiles (*),
      guest_sessions (*)
    `)
    .eq('id', threadId)
    .single();
    
  if (error) {
    console.error(`Error fetching thread ${threadId}:`, error);
    return null;
  }
  return data as Thread;
}

export async function getPostsByThread(threadId: string, limit: number = 50, offset: number = 0): Promise<Post[]> {
  if (!supabase) return [];
  const query = supabase
    .from('posts')
    .select(`*, profiles (*), guest_sessions (*)`)
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  // Show published + own pending_review posts
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (uid) {
    const { data, error } = await query.or(`status.eq.published,and(status.eq.pending_review,author_id.eq.${uid})`);
    if (error) { console.error('Error fetching posts:', error); return []; }
    return data as Post[];
  } else {
    const { data, error } = await query.eq('status', 'published');
    if (error) { console.error('Error fetching posts:', error); return []; }
    return data as Post[];
  }
}

export async function getActiveAICharacters(): Promise<AICharacter[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ai_characters')
    .select(`
      *,
      profiles (*)
    `)
    .eq('is_active', true);
    
  if (error) {
    console.error('Error fetching AI characters:', error);
    return [];
  }
  return data as AICharacter[];
}

// ─── Guest Sessions ───
export async function createGuestSession(username: string): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('create_guest_rpc', {
    p_username: username,
  });
  if (error) throw error;
  return data as string; // returns the new guest session UUID
}

// ─── Thread Creation ───
// Requires turnstileToken for Edge Function verification.
// Falls back to direct DB insert if Edge Function is not deployed.
export async function createThread(params: {
  boardId: string;
  title: string;
  content: string;
  authorId?: string;
  guestId?: string;
  turnstileToken?: string;
  createdAt?: string;
}): Promise<Thread> {
  // Try Edge Function first (verifies Turnstile server-side)
  if (supabase) {
    const result = await callPostHandler({
      action: 'create_thread',
      board_id: params.boardId,
      title: params.title,
      content: params.content,
      author_id: params.authorId || undefined,
      guest_id: params.guestId || undefined,
      turnstile_token: params.turnstileToken || '',
      created_at: params.createdAt || undefined,
    });
    if (result?.thread) return result.thread as Thread;
  }

  // Fallback: use RPC function (SECURITY DEFINER, bypasses RLS)
  const db = requireSupabase();
  const { data, error } = await db.rpc('create_thread_rpc', {
    p_board_id: params.boardId,
    p_title: params.title,
    p_content: params.content,
    p_author_id: params.authorId || null,
    p_guest_id: params.guestId || null,
  });

  if (error) throw error;
  const threads = data as Thread[];
  if (!threads || threads.length === 0) throw new Error('创建失败');
  return threads[0];
}

// ─── Post Creation ───
export async function createPost(params: {
  threadId: string;
  content: string;
  authorId?: string;
  guestId?: string;
  parentPostId?: string;
  turnstileToken?: string;
  createdAt?: string;
}): Promise<Post> {
  // Try Edge Function first
  if (supabase) {
    const result = await callPostHandler({
      action: 'create_post',
      thread_id: params.threadId,
      content: params.content,
      author_id: params.authorId || undefined,
      guest_id: params.guestId || undefined,
      parent_post_id: params.parentPostId || undefined,
      turnstile_token: params.turnstileToken || '',
      created_at: params.createdAt || undefined,
    });
    if (result?.post) return result.post as Post;
  }

  // Fallback: use RPC function (SECURITY DEFINER, bypasses RLS)
  const db = requireSupabase();
  const { data, error } = await db.rpc('create_post_rpc', {
    p_thread_id: params.threadId,
    p_content: params.content,
    p_author_id: params.authorId || null,
    p_guest_id: params.guestId || null,
    p_parent_post_id: params.parentPostId || null,
  });

  if (error) throw error;
  const posts = data as Post[];
  if (!posts || posts.length === 0) throw new Error('创建失败');
  return posts[0];
}

// ─── Thread Update ───
export async function updateThread(threadId: string, updates: { title?: string; content?: string; boardId?: string }): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('threads')
    .update({ 
      title: updates.title,
      content: updates.content,
      board_id: updates.boardId,
      edited_at: new Date().toISOString() 
    })
    .eq('id', threadId);
  if (error) throw error;
}

// ─── Post Update ───
export async function updatePost(postId: string, content: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('posts')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw error;
}

// ─── Soft Delete ───
export async function softDeleteThread(threadId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('threads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', threadId);
  if (error) throw error;
}

export async function softDeletePost(postId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw error;
}

// ─── Notifications ───
export async function createNotification(params: {
  recipientId: string;
  type: 'mention' | 'reply' | 'like';
  actorId?: string;
  threadId?: string;
  postId?: string;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('notifications')
    .insert({
      recipient_id: params.recipientId,
      type: params.type,
      actor_id: params.actorId || null,
      thread_id: params.threadId || null,
      post_id: params.postId || null,
    });
  if (error) throw error;
}
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }
  return count || 0;
}

export async function getNotifications(userId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      profiles (*),
      threads (*)
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const db = requireSupabase();
  await db
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

// ─── User Lookup ───
export async function getProfileByUsername(username: string): Promise<import('./types').Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error) return null;
  return data as import('./types').Profile;
}

// ─── User Blog ───
export async function getThreadsByAuthor(authorId: string): Promise<Thread[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      boards (*),
      profiles (*),
      guest_sessions (*)
    `)
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching threads by author:', error);
    return [];
  }
  return data as Thread[];
}

export async function getAICharacterByProfileId(profileId: string): Promise<AICharacter | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('ai_characters')
    .select(`
      *,
      profiles (*)
    `)
    .eq('id', profileId)
    .single();

  if (error) return null;
  return data as AICharacter;
}

export async function getThreadsByReplies(authorId: string): Promise<Thread[]> {
  if (!supabase) return [];
  // Get distinct thread IDs from posts by this author, then fetch those threads
  const { data: postThreads } = await supabase
    .from('posts')
    .select('thread_id')
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .eq('status', 'published');

  if (!postThreads || postThreads.length === 0) return [];

  const threadIds = [...new Set(postThreads.map(p => p.thread_id))].slice(0, 50);
  const { data, error } = await supabase
    .from('threads')
    .select('*, boards (*), profiles (*), guest_sessions (*)')
    .in('id', threadIds)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data as Thread[];
}

export async function getPostCountByAuthor(authorId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .eq('status', 'published');

  if (error) return 0;
  return count ?? 0;
}

// ─── Admin: Moderation ───
export async function getPendingThreads(): Promise<Thread[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_pending_threads');
  if (error) throw error;
  return (data as Thread[]) || [];
}

export async function getPendingPosts(): Promise<Post[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_pending_posts');
  if (error) throw error;
  return (data as Post[]) || [];
}

export async function approveThread(threadId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_approve_thread', { p_thread_id: threadId });
  if (error) throw error;
}

export async function rejectThread(threadId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_reject_thread', { p_thread_id: threadId });
  if (error) throw error;
}

export async function approvePost(postId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_approve_post', { p_post_id: postId });
  if (error) throw error;
}

export async function rejectPost(postId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_reject_post', { p_post_id: postId });
  if (error) throw error;
}

export async function getBlockedIps() {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_blocked_ips');
  if (error) throw error;
  return data || [];
}

export async function resetBlockedIp(ipId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_reset_ip', { p_ip_id: ipId });
  if (error) throw error;
}

// ─── Admin: Characters ───
export async function adminGetAllCharacters(): Promise<AICharacter[]> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_all_characters');
  if (error) throw error;
  return (data || []) as AICharacter[];
}

export async function adminUpdateCharacter(id: string, params: {
  personality_prompt: string;
  comedy_notes: string;
  writing_style: string;
  is_active: boolean;
  bio: string;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_update_character', {
    p_id: id,
    p_personality_prompt: params.personality_prompt,
    p_comedy_notes: params.comedy_notes,
    p_writing_style: params.writing_style,
    p_is_active: params.is_active,
    p_bio: params.bio,
  });
  if (error) throw error;
}

// ─── Admin: Tasks ───
export async function adminGetTaskQueue() {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_task_queue');
  if (error) throw error;
  return data || [];
}

export async function adminAddResponseTask(characterId: string, threadId: string, triggerPostId: string) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_add_response_task', {
    p_character_id: characterId,
    p_thread_id: threadId,
    p_trigger_post_id: triggerPostId,
  });
  if (error) throw error;
  return data;
}

export async function adminCancelTask(taskId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_cancel_task', { p_task_id: taskId });
  if (error) throw error;
}

// ─── Admin: Direct Edit ───
export async function adminUpdateThread(threadId: string, params: {
  title: string; content: string; boardId: string; createdAt: string;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_update_thread', {
    p_thread_id: threadId, p_title: params.title, p_content: params.content,
    p_board_id: params.boardId, p_created_at: params.createdAt,
  });
  if (error) throw error;
}

export async function adminSoftDeleteThread(threadId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_soft_delete_thread', { p_thread_id: threadId });
  if (error) throw error;
}

export async function adminSoftDeletePost(postId: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_soft_delete_post', { p_post_id: postId });
  if (error) throw error;
}

export async function adminUpdatePost(postId: string, content: string, createdAt: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_update_post', {
    p_post_id: postId, p_content: content, p_created_at: createdAt,
  });
  if (error) throw error;
}

// ─── Admin: Character CRUD ───
export async function adminCreateCharacter(params: {
  username: string; era: string; birth_year: number | null; death_year: number | null;
  tags: string[]; personality: string; comedy: string; style: string;
}): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_create_character', {
    p_username: params.username, p_era: params.era,
    p_birth_year: params.birth_year, p_death_year: params.death_year,
    p_tags: params.tags, p_personality: params.personality,
    p_comedy: params.comedy, p_style: params.style,
  });
  if (error) throw error;
  return data as string;
}

export async function adminDeleteCharacter(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_delete_character', { p_id: id });
  if (error) throw error;
}

// ─── Admin: User Management ───
export async function adminGetUsers() {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_users');
  if (error) throw error;
  return (data || []) as { id: string; username: string; bio: string; avatar_url: string; created_at: string }[];
}

export async function adminUpdateUser(id: string, username: string, bio: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_update_user', { p_id: id, p_username: username, p_bio: bio });
  if (error) throw error;
}

export async function adminCreateVirtualUser(username: string, bio: string): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_create_virtual_user', {
    p_username: username, p_bio: bio,
  });
  if (error) throw error;
  return data as string;
}

export async function adminDeleteUser(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_delete_user', { p_id: id });
  if (error) throw error;
}

// ─── Thread Lock ───
export async function toggleThreadLock(threadId: string, locked: boolean): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_toggle_lock', { p_thread_id: threadId, p_locked: locked });
  if (error) throw error;
}

// ─── Admin: Boards ───
export async function adminCreateBoard(params: {
  name: string; slug: string; description: string; era_tag: string; icon: string;
}): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_create_board', {
    p_name: params.name, p_slug: params.slug, p_description: params.description,
    p_era_tag: params.era_tag, p_icon: params.icon,
  });
  if (error) throw error;
  return data as string;
}

export async function adminUpdateBoard(id: string, params: {
  name: string; slug: string; description: string; era_tag: string; icon: string; display_order: number;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_update_board', {
    p_id: id, p_name: params.name, p_slug: params.slug, p_description: params.description,
    p_era_tag: params.era_tag, p_icon: params.icon, p_display_order: params.display_order,
  });
  if (error) throw error;
}

export async function adminDeleteBoard(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_delete_board', { p_id: id });
  if (error) throw error;
}

// ─── Pin Levels ───
export async function toggleFeatured(threadId: string, featured: boolean): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_toggle_featured', { p_thread_id: threadId, p_featured: featured });
  if (error) throw error;
}

export async function setPinLevel(threadId: string, level: number): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_set_pin_level', { p_thread_id: threadId, p_level: level });
  if (error) throw error;
}

export async function getFeaturedThreads(): Promise<Thread[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('threads')
    .select(`*, boards (*), profiles (*), guest_sessions (*)`)
    .eq('is_featured', true)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('last_post_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return data as Thread[];
}

// ─── Admin: Stats ───
// ─── Likes ───
export function getGuestLikeId(): string {
  let id = localStorage.getItem('anachron_like_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('anachron_like_id', id);
  }
  return id;
}

export async function toggleLike(postId: string, userId: string | null, guestId?: string): Promise<boolean> {
  const db = requireSupabase();
  const guestLikeId = guestId || getGuestLikeId();
  // Check if already liked
  if (userId) {
    const { data: existing } = await db
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await db.from('likes').delete().eq('id', existing.id);
      return false;
    }
    await db.from('likes').insert({ post_id: postId, user_id: userId });
  } else {
    const { data: existing } = await db
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('guest_id', guestLikeId)
      .maybeSingle();

    if (existing) {
      await db.from('likes').delete().eq('id', existing.id);
      return false;
    }
    await db.from('likes').insert({ post_id: postId, guest_id: guestLikeId });
  }
  return true;
}

// ─── Thread Likes (PostCard 点赞) ───
export async function toggleThreadLike(threadId: string, userId: string | null, guestId?: string): Promise<boolean> {
  const db = requireSupabase();
  const guestLikeId = guestId || getGuestLikeId();
  if (userId) {
    const { data: existing } = await db
      .from('thread_likes')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await db.from('thread_likes').delete().eq('id', existing.id);
      return false;
    }
    await db.from('thread_likes').insert({ thread_id: threadId, user_id: userId });
  } else {
    const { data: existing } = await db
      .from('thread_likes')
      .select('id')
      .eq('thread_id', threadId)
      .eq('guest_id', guestLikeId)
      .maybeSingle();

    if (existing) {
      await db.from('thread_likes').delete().eq('id', existing.id);
      return false;
    }
    await db.from('thread_likes').insert({ thread_id: threadId, guest_id: guestLikeId });
  }
  return true;
}

export async function getThreadLikes(userId: string | null, threadIds: string[]): Promise<Set<string>> {
  const guestLikeId = getGuestLikeId();
  if (!supabase || threadIds.length === 0) return new Set();
  if (userId) {
    const { data } = await supabase
      .from('thread_likes')
      .select('thread_id')
      .eq('user_id', userId)
      .in('thread_id', threadIds);
    return new Set((data || []).map((l: { thread_id: string }) => l.thread_id));
  } else {
    const { data } = await supabase
      .from('thread_likes')
      .select('thread_id')
      .eq('guest_id', guestLikeId)
      .in('thread_id', threadIds);
    return new Set((data || []).map((l: { thread_id: string }) => l.thread_id));
  }
}

export async function getUserLikes(userId: string | null, postIds: string[]): Promise<Set<string>> {
  const guestLikeId = getGuestLikeId();
  if (!supabase || postIds.length === 0) return new Set();
  if (userId) {
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);
    return new Set((data || []).map((l: { post_id: string }) => l.post_id));
  } else {
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('guest_id', guestLikeId)
      .in('post_id', postIds);
    return new Set((data || []).map((l: { post_id: string }) => l.post_id));
  }
}

export async function adminGetDailyStats(days: number = 7) {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_daily_stats', { p_days: days });
  if (error) throw error;
  return data || [];
}

// ─── Reporting ───
export async function createReport(params: {
  targetType: 'thread' | 'post';
  targetId: string;
  reason: string;
  reporterId: string;
}): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from('reports').insert({
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason,
    reporter_id: params.reporterId,
  });
  if (error) throw error;
}

export async function adminGetPendingReports() {
  const db = requireSupabase();
  const { data, error } = await db.rpc('admin_get_pending_reports');
  if (error) throw error;
  return data || [];
}

export async function adminResolveReport(reportId: string, status: 'resolved' | 'dismissed'): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc('admin_resolve_report', { p_report_id: reportId, p_status: status });
  if (error) throw error;
}
