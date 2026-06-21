import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { getBoards, getFeaturedThreads, getLatestThreads } from '../../lib/api';
import type { Board, Thread } from '../../lib/types';

export default function RightPanel() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [hotThreads, setHotThreads] = useState<Thread[]>([]);
  const [latestThreads, setLatestThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topOffset, setTopOffset] = useState(72);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const [fetchedBoards, fetchedHotThreads, fetchedLatestThreads] = await Promise.all([
        getBoards(),
        getFeaturedThreads(),
        getLatestThreads(10),
      ]);
      setBoards(fetchedBoards);
      setHotThreads(fetchedHotThreads);
      setLatestThreads(fetchedLatestThreads);
      setIsLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    const checkHeight = () => {
      if (panelRef.current) {
        const height = panelRef.current.offsetHeight;
        const viewportHeight = window.innerHeight;
        // Formula: stick to top (72px) if short, 
        // or stick to bottom (viewport - height - 24px) if long.
        // We take the minimum to ensure it never goes lower than 72px unless necessary to show the bottom.
        const calculatedTop = Math.min(72, viewportHeight - height - 24);
        setTopOffset(calculatedTop);
      }
    };
    
    checkHeight();
    window.addEventListener('resize', checkHeight);
    const timer = setTimeout(checkHeight, 100);
    
    return () => {
      window.removeEventListener('resize', checkHeight);
      clearTimeout(timer);
    };
  }, [boards, hotThreads, latestThreads, isLoading]);

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div 
        ref={panelRef}
        className="sticky flex flex-col gap-4"
        style={{ top: `${topOffset}px` }}
      >
        {/* Board navigation */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            版块导航
          </div>
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
            ) : (
              boards.map((board) => (
                <Link
                  key={board.slug}
                  to={`/b/${board.slug}`}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span className="text-base">{board.icon}</span>
                  <span>{board.name}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Hot / Featured Threads */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            ⭐ 精华帖子
          </div>
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
            ) : hotThreads.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无精华帖</div>
            ) : (
              hotThreads.map((thread) => (
                <Link
                  key={thread.id}
                  to={`/b/${thread.boards?.slug || 'current-affairs'}/t/${thread.id}`}
                  className="block px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <div className="truncate font-medium">{thread.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {thread.reply_count} 回复 · {thread.like_count || 0} 赞
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Latest active threads */}
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--color-card-bg)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="px-4 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            🔥 最新讨论
          </div>
          <div className="py-1">
            {isLoading ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>加载中...</div>
            ) : latestThreads.length === 0 ? (
              <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无帖子</div>
            ) : (
              latestThreads.map((thread) => (
                <Link
                  key={thread.id}
                  to={`/b/${thread.boards?.slug || 'current-affairs'}/t/${thread.id}`}
                  className="block px-4 py-2 text-sm no-underline transition-colors hover:bg-[var(--color-page-bg)]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <div className="truncate font-medium">{thread.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {thread.reply_count} 回复 · {thread.like_count || 0} 赞
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

