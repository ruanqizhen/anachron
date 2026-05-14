import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [hasMore, setHasMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const performSearch = useCallback(async (q: string, offset: number = 0) => {
    const { data, error } = await supabase!
      .rpc('search_forum', { search_term: q, p_limit: 20, p_offset: offset })
      .select('*, boards (*), profiles (*), guest_sessions (*)');

    if (error) {
      console.error('Search error:', error);
      if (offset === 0) setResults([]);
      setHasMore(false);
    } else {
      const more = (data || []) as unknown as Thread[];
      if (offset === 0) {
        setResults(more);
      } else {
        setResults(prev => [...prev, ...more]);
      }
      setHasMore(more.length >= 20);
    }
    setIsLoading(false);
  }, []);

  const loadMore = useCallback(() => {
    if (!query.trim() || isLoading || !hasMore) return;
    performSearch(query.trim(), results.length);
  }, [query, isLoading, hasMore, results.length, performSearch]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, isLoading]);

  useEffect(() => {
    if (!query.trim() || !supabase) {
      setTimeout(() => setResults([]), 0);
      return;
    }

    // Debounce: wait 300ms before searching
    const timer = setTimeout(() => {
      setIsLoading(true);
      performSearch(query.trim(), 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

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
          {hasMore && (
            <div ref={loaderRef} className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              加载更多...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
