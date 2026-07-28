import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import PostCard from './PostCard';
import type { Thread } from '../../lib/types';

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
  cacheKey,
}: ThreadFeedProps) {
  const render = renderCard || ((t: Thread) => <PostCard thread={t} />);

  const initialData = cacheKey ? feedCache[cacheKey] : null;
  const hasValidCache = !!(initialData && initialData.threads.length > 0);

  const [threads, setThreads] = useState<Thread[]>(initialData?.threads || []);
  const [isLoading, setIsLoading] = useState(!hasValidCache);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? true);

  const loaderRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef<number>(initialData?.threads.length || 0);
  const isLoadingMoreRef = useRef(false);
  const fetchThreadsRef = useRef(fetchThreads);
  fetchThreadsRef.current = fetchThreads;

  const hasFetchedOnceRef = useRef(hasValidCache);
  const prevRefreshKeyRef = useRef(refreshKey);
  const prevCacheKeyRef = useRef(cacheKey);

  useEffect(() => {
    const isRefresh = refreshKey !== undefined && prevRefreshKeyRef.current !== refreshKey;
    const cacheKeyChanged = prevCacheKeyRef.current !== cacheKey;
    prevRefreshKeyRef.current = refreshKey;
    prevCacheKeyRef.current = cacheKey;

    if (cacheKeyChanged) {
      hasFetchedOnceRef.current = false;
      offsetRef.current = 0;
    }

    if (hasValidCache && !isRefresh && !cacheKeyChanged && hasFetchedOnceRef.current) {
      setIsLoading(false);
      offsetRef.current = initialData!.threads.length;
      return;
    }

    let active = true;
    const fetchFirst = async () => {
      if (!initialData || isRefresh) setIsLoading(true);
      try {
        const items = await fetchThreadsRef.current(PAGE_SIZE, 0);
        if (!active) return;
        setThreads(items);
        offsetRef.current = items.length;
        setHasMore(items.length >= PAGE_SIZE);
        setIsLoading(false);
        hasFetchedOnceRef.current = true;
        if (cacheKey) {
          feedCache[cacheKey] = { threads: items, hasMore: items.length >= PAGE_SIZE };
        }
      } catch {
        if (active) setIsLoading(false);
      }
    };
    fetchFirst();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, cacheKey]);

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    try {
      const offset = offsetRef.current;
      const more = await fetchThreadsRef.current(PAGE_SIZE, offset);
      if (more.length > 0) {
        setThreads(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const deduped = more.filter(t => !existingIds.has(t.id));
          const newThreads = [...prev, ...deduped];
          offsetRef.current = newThreads.length;
          if (cacheKey) {
            feedCache[cacheKey] = { threads: newThreads, hasMore: deduped.length >= PAGE_SIZE || more.length >= PAGE_SIZE };
          }
          return newThreads;
        });
        // functional check above handles hasMore via deduped
        if (more.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
      } else {
        setHasMore(false);
        if (cacheKey && feedCache[cacheKey]) {
          feedCache[cacheKey].hasMore = false;
        }
      }
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [cacheKey]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || isLoading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMoreRef.current) loadMore();
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoading, loadMore]);

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
