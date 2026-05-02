import { supabase } from './supabase';
import type { Board, Thread, Post, AICharacter } from './types';

// ─── Helper ───
function requireSupabase() {
  if (!supabase) throw new Error('Supabase 未配置');
  return supabase;
}

const edgeFunctionUrl = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/post-handler`
  : '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Call the post-handler Edge Function which verifies Turnstile server-side
// and inserts into DB with Service Role (bypasses RLS).
async function callPostHandler(payload: Record<string, unknown>) {
  if (!edgeFunctionUrl) {
    // Fallback: no Edge Function deployed, insert directly via Supabase client
    return null;
  }
  const resp = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `Edge Function error: ${resp.status}`);
  }
  return data;
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

// ─── Thread Creation ───
// Requires turnstileToken for Edge Function verification.
// Falls back to direct DB insert if Edge Function is not deployed.
export async function createThread(params: {
  boardId: string;
  title: string;
  content: string;
  authorId?: string;
  turnstileToken?: string;
}): Promise<Thread> {
  // Try Edge Function first (verifies Turnstile server-side)
  if (edgeFunctionUrl) {
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

  // Fallback: direct DB insert (RLS enforced, no Turnstile backend verification)
  const db = requireSupabase();
  const { data, error } = await db
    .from('threads')
    .insert({
      board_id: params.boardId,
      title: params.title,
      content: params.content,
      author_id: params.authorId || null,
      status: 'published',
    })
    .select(`
      *,
      boards (*),
      profiles (*)
    `)
    .single();

  if (error) throw error;
  return data as Thread;
}

// ─── Post Creation ───
export async function createPost(params: {
  threadId: string;
  content: string;
  authorId?: string;
  parentPostId?: string;
  turnstileToken?: string;
}): Promise<Post> {
  // Try Edge Function first
  if (edgeFunctionUrl) {
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

  // Fallback: direct DB insert
  const db = requireSupabase();
  const { data, error } = await db
    .from('posts')
    .insert({
      thread_id: params.threadId,
      content: params.content,
      author_id: params.authorId || null,
      parent_post_id: params.parentPostId || null,
      status: 'published',
    })
    .select(`
      *,
      profiles (*)
    `)
    .single();

  if (error) throw error;
  return data as Post;
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
