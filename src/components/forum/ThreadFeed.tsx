import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import PostCard from './PostCard';
import type { Thread } from '../../lib/types';

interface ThreadFeedProps {
  fetchThreads: (limit: number, offset: number) => Promise<Thread[]>;
  refreshKey?: number;
  emptyMessage?: string;
  renderCard?: (thread: Thread) => ReactNode;
}

const PAGE_SIZE = 20;

export default function ThreadFeed({ fetchThreads, refreshKey, emptyMessage = '暂无内容', renderCard }: ThreadFeedProps) {
  const render = renderCard || ((t: Thread) => <PostCard thread={t} />);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadFirst = useCallback(async () => {
    setIsLoading(true);
    const items = await fetchThreads(PAGE_SIZE, 0);
    setThreads(items);
    setHasMore(items.length >= PAGE_SIZE);
    setIsLoading(false);
  }, [fetchThreads]);

  useEffect(() => { loadFirst(); }, [loadFirst, refreshKey]);

  const loadMore = useCallback(async () => {
    const more = await fetchThreads(PAGE_SIZE, threads.length);
    if (more.length > 0) {
      setThreads(prev => [...prev, ...more]);
      setHasMore(more.length >= PAGE_SIZE);
    } else {
      setHasMore(false);
    }
  }, [fetchThreads, threads.length]);

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
