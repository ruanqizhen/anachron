import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import PostCard from './PostCard';
import type { Thread } from '../../lib/types';

// Simple global cache to persist feeds across navigation
const feedCache: Record<string, { threads: Thread[]; hasMore: boolean }> = {};

interface ThreadFeedProps {
  fetchThreads: (limit: number, offset: number) => Promise<Thread[]>;
  refreshKey?: number;
  emptyMessage?: string;
  renderCard?: (thread: Thread) => ReactNode;
  cacheKey?: string;
}

const PAGE_SIZE = 20;

export default function ThreadFeed({ 
  fetchThreads, 
  refreshKey, 
  emptyMessage = '暂无内容', 
  renderCard,
  cacheKey
}: ThreadFeedProps) {
  const render = renderCard || ((t: Thread) => <PostCard thread={t} />);
  
  // Initialize from cache if available
  const initialData = cacheKey ? feedCache[cacheKey] : null;
  
  const [threads, setThreads] = useState<Thread[]>(initialData?.threads || []);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const fetchFirst = async () => {
      // If we have cached data, we can still refresh in background if it's the first mount
      // but to avoid flickering we only set isLoading if cache is empty
      if (threads.length === 0) setIsLoading(true);
      
      const items = await fetchThreads(PAGE_SIZE, 0);
      if (active) {
        setThreads(items);
        setHasMore(items.length >= PAGE_SIZE);
        setIsLoading(false);
        
        // Update cache
        if (cacheKey) {
          feedCache[cacheKey] = { threads: items, hasMore: items.length >= PAGE_SIZE };
        }
      }
    };
    fetchFirst();
    return () => { active = false; };
  }, [fetchThreads, refreshKey, cacheKey]);

  const loadMore = useCallback(async () => {
    const more = await fetchThreads(PAGE_SIZE, threads.length);
    if (more.length > 0) {
      const newThreads = [...threads, ...more];
      setThreads(newThreads);
      setHasMore(more.length >= PAGE_SIZE);
      
      // Update cache
      if (cacheKey) {
        feedCache[cacheKey] = { threads: newThreads, hasMore: more.length >= PAGE_SIZE };
      }
    } else {
      setHasMore(false);
      if (cacheKey && feedCache[cacheKey]) {
        feedCache[cacheKey].hasMore = false;
      }
    }
  }, [fetchThreads, threads, cacheKey]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="flex flex-col gap-4">
      {isLoading && threads.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
      ) : threads.length > 0 ? (
        <>
          {threads.map(thread => <React.Fragment key={thread.id}>{render(thread)}</React.Fragment>)}
          {hasMore && (
            <div ref={loaderRef} className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              加载更多...
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
