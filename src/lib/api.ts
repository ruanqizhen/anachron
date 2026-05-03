import { supabase } from './supabase';
import type { Board, Thread, Post, AICharacter } from './types';

// ─── Helper ───
function requireSupabase() {
  if (!supabase) throw new Error('Supabase 未配置');
  return supabase;
}

// Call the post-handler Edge Function via Supabase client (handles auth properly).
// Returns null if Edge Function is unreachable so callers fall back to RPC.
async function callPostHandler(payload: Record<string, unknown>) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('post-handler', {
      body: payload,
    });
    if (error) {
      // Edge Function returned an error
      throw new Error((error as any).message || `服务器错误`);
    }
    return data;
  } catch (err: any) {
    // Network error or function not deployed → silent fallback to RPC
    if (
      err instanceof TypeError ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError')
    ) {
      console.warn('Edge Function unreachable, falling back to RPC');
      return null;
    }
    throw err;
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

export async function getRecentThreads(limit: number = 20): Promise<Thread[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      boards (*),
      profiles (*),
      guest_sessions (*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching recent threads:', error);
    return [];
  }
  return data as Thread[];
}

export async function getThreadsByBoard(boardId: string, limit: number = 50): Promise<Thread[]> {
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
    .order('is_pinned', { ascending: false })
    .order('last_post_at', { ascending: false })
    .limit(limit);
    
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

export async function getPostsByThread(threadId: string): Promise<Post[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles (*),
      guest_sessions (*)
    `)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error(`Error fetching posts for thread ${threadId}:`, error);
    return [];
  }
  return data as Post[];
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
}): Promise<Thread> {
  // Try Edge Function first (verifies Turnstile server-side)
  if (supabase) {
    const result = await callPostHandler({
      action: 'create_thread',
      board_id: params.boardId,
      title: params.title,
      content: params.content,
      author_id: params.authorId || undefined,
      turnstile_token: params.turnstileToken || '',
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
}): Promise<Post> {
  // Try Edge Function first
  if (supabase) {
    const result = await callPostHandler({
      action: 'create_post',
      thread_id: params.threadId,
      content: params.content,
      author_id: params.authorId || undefined,
      parent_post_id: params.parentPostId || undefined,
      turnstile_token: params.turnstileToken || '',
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
export async function updateThread(threadId: string, updates: { title?: string; content?: string }): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from('threads')
    .update({ ...updates, edited_at: new Date().toISOString() })
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
