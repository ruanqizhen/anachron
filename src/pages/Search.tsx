import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PostCard from '../components/forum/PostCard';
import type { Thread } from '../lib/types';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function performSearch(q: string) {
    const term = `%${q}%`;
    const [titleRes, contentRes] = await Promise.all([
      supabase!
        .from('threads')
        .select('*, boards (*), profiles (*), guest_sessions (*)')
        .ilike('title', term)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase!
        .from('threads')
        .select('*, boards (*), profiles (*), guest_sessions (*)')
        .ilike('content', term)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    const map = new Map<string, Thread>();
    const add = (arr: Thread[]) => arr.forEach(t => map.set(t.id, t as Thread));
    add((titleRes.data || []) as Thread[]);
    add((contentRes.data || []) as Thread[]);
    setResults([...map.values()].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setIsLoading(false);
  }

  useEffect(() => {
    if (!query.trim() || !supabase) {
      setTimeout(() => setResults([]), 0);
      return;
    }

    // Debounce: wait 300ms before searching
    const timer = setTimeout(() => {
      setIsLoading(true);
      performSearch(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      <h1 className="text-xl font-bold mb-1">搜索结果</h1>
      {query && (
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          「{query}」— {results.length} 条结果
        </p>
      )}

      {!query ? (
        <div className="text-center py-20">
          <SearchIcon size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>输入关键词搜索</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>搜索中...</div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <SearchIcon size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>未找到相关内容，换个关键词试试？</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {results.map(thread => (
            <PostCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}
    </div>
  );
}
