import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ThreadFeed from '../components/forum/ThreadFeed';
import type { Thread } from '../lib/types';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  // Removed local results state as ThreadFeed handles it
  const [isSearching, setIsSearching] = useState(false);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (query.trim()) {
      setIsSearching(true);
    }
  }

  const performSearch = useCallback(async (limit: number, offset: number): Promise<Thread[]> => {
    if (!query.trim()) return [];
    
    const { data, error } = await supabase!
      .rpc('search_forum', { search_term: query.trim(), p_limit: limit, p_offset: offset })
      .select('*, boards (*), profiles (*), guest_sessions (*)');

    if (error) {
      console.error('Search error:', error);
      return [];
    }
    return (data || []) as unknown as Thread[];
  }, [query]);

  useEffect(() => {
    if (!isSearching) return;
    const timer = setTimeout(() => setIsSearching(false), 300);
    return () => clearTimeout(timer);
  }, [isSearching]);

  return (
    <div className="max-w-[800px] mx-auto px-4 pt-[72px] pb-8">
      <h1 className="text-xl font-bold mb-1">搜索结果</h1>
      {query && (
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          「{query}」
        </p>
      )}

      {!query ? (
        <div className="text-center py-20">
          <SearchIcon size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>输入关键词搜索</p>
        </div>
      ) : isSearching ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>搜索中...</div>
      ) : (
        <ThreadFeed 
          fetchThreads={performSearch} 
          refreshKey={0} // Query change is handled by ThreadFeed's dependency on fetchThreads
          emptyMessage="未找到相关内容，换个关键词试试？" 
          cacheKey={`search-${query}`}
        />
      ) }
    </div>
  );
}
