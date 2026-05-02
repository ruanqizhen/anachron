import { supabase } from './supabase';
import type { Board, Thread, Post, AICharacter } from './types';

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
