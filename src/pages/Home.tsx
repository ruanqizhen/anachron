import PostCard from '../components/forum/PostCard';
import RightPanel from '../components/layout/RightPanel';
import CreatePostForm from '../components/forum/CreatePostForm';
import { Link } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecentThreads, getBoards } from '../lib/api';
import type { Thread, Board } from '../lib/types';

const PAGE_SIZE = 20;

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [fetchedThreads, fetchedBoards] = await Promise.all([
        getRecentThreads(PAGE_SIZE, 0),
        getBoards()
      ]);
      setThreads(fetchedThreads);
      setBoards(fetchedBoards);
      setHasMore(fetchedThreads.length >= PAGE_SIZE);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const loadMore = useCallback(async () => {
    const offset = threads.length;
    const more = await getRecentThreads(PAGE_SIZE, offset);
    if (more.length > 0) {
      setThreads(prev => [...prev, ...more]);
      setHasMore(more.length >= PAGE_SIZE);
    } else {
      setHasMore(false);
    }
  }, [threads.length]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-[72px] pb-8">
      <div className="flex gap-6">
        {/* Main feed */}
        <main className="flex-1 min-w-0">
          {/* Create post prompt */}
          <div
            className="rounded-lg px-4 py-3 mb-4 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--color-card-bg)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 rounded-full px-4 py-2.5 text-sm cursor-pointer hover:bg-[var(--color-page-bg)] transition-colors"
              style={{
                backgroundColor: 'var(--color-page-bg)',
                color: 'var(--color-text-muted)',
              }}
            >
              写点什么...
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <PenSquare size={16} />
              发帖
            </button>
          </div>

          {/* Mobile board tags */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 lg:hidden scrollbar-none">
            {boards.map((board) => (
              <Link
                key={board.slug}
                to={`/b/${board.slug}`}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium no-underline whitespace-nowrap transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--color-card-bg)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {board.icon} {board.name}
              </Link>
            ))}
          </div>

          {/* Thread feed */}
          <div className="flex flex-col gap-4">
            {isLoading && threads.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                加载中...
              </div>
            ) : threads.length > 0 ? (
              <>
                {threads.map((thread) => (
                  <PostCard key={thread.id} thread={thread} />
                ))}
                {hasMore && (
                  <div ref={loaderRef} className="text-center py-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    加载更多...
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                暂无帖子
              </div>
            )}
          </div>
        </main>

        {/* Right panel - desktop only */}
        <RightPanel />
      </div>

      {isCreateModalOpen && (
        <CreatePostForm
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={async () => {
            const fetched = await getRecentThreads(PAGE_SIZE, 0);
            setThreads(fetched);
            setHasMore(fetched.length >= PAGE_SIZE);
          }}
        />
      )}
    </div>
  );
}
